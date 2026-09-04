import { readFileSync } from 'node:fs';
import zlib from 'node:zlib';

function entries(file) {
  const b = readFileSync(file); let e = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65558); i--) if (b.readUInt32LE(i) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error(`Invalid OOXML archive: ${file}`);
  const out = Object.create(null); let p = b.readUInt32LE(e + 16); const end = p + b.readUInt32LE(e + 12);
  while (p < end && b.readUInt32LE(p) === 0x02014b50) {
    const method = b.readUInt16LE(p + 10), size = b.readUInt32LE(p + 20), nl = b.readUInt16LE(p + 28), xl = b.readUInt16LE(p + 30), cl = b.readUInt16LE(p + 32), off = b.readUInt32LE(p + 42);
    const name = b.toString('utf8', p + 46, p + 46 + nl), dataAt = off + 30 + b.readUInt16LE(off + 26) + b.readUInt16LE(off + 28), raw = b.slice(dataAt, dataAt + size);
    out[name] = (method === 0 ? raw : zlib.inflateRawSync(raw)).toString('utf8'); p += 46 + nl + xl + cl;
  }
  return out;
}
const decode = (s = '') => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#10;/g, '\n').replace(/&#13;/g, '\r').replace(/&amp;/g, '&');
function col(ref) { let n = 0; for (const c of (/^([A-Z]+)/.exec(ref) || ['', 'A'])[1]) n = n * 26 + c.charCodeAt(0) - 64; return n - 1; }
function parseSheet(xml, shared) {
  const rows = []; let m; const rr = /<(?:x:)?row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/(?:x:)?row>/g;
  while ((m = rr.exec(xml))) {
    const row = []; let c; const cr = /<(?:x:)?c\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:x:)?c>)/g;
    while ((c = cr.exec(m[2]))) {
      const attrs = c[1], body = c[2] || '', ref = /r="([A-Z]+\d+)"/.exec(attrs), type = /t="([^"]+)"/.exec(attrs)?.[1] || '', vm = /<(?:x:)?v>([\s\S]*?)<\/(?:x:)?v>/.exec(body);
      let value = vm ? decode(vm[1]) : '';
      if (type === 's' && vm) value = shared[Number(vm[1])] || '';
      if (type === 'inlineStr') value = [...body.matchAll(/<(?:x:)?t[^>]*>([\s\S]*?)<\/(?:x:)?t>/g)].map(x => decode(x[1])).join('');
      row[ref ? col(ref[1]) : row.length] = value;
    }
    rows[Number(m[1]) - 1] = row;
  }
  return rows;
}
export function readWorkbook(file) {
  const e = entries(file), wb = e['xl/workbook.xml'], rels = e['xl/_rels/workbook.xml.rels'] || '', shared = [];
  for (const m of (e['xl/sharedStrings.xml'] || '').matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) shared.push([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => decode(x[1])).join(''));
  const targets = Object.create(null); for (const m of rels.matchAll(/<Relationship\s+([^>]+?)\s*\/>/g)) { const id = /\bId="([^"]+)"/.exec(m[1])?.[1], t = /\bTarget="([^"]+)"/.exec(m[1])?.[1]; if (id && t) targets[id] = t; }
  const sheets = Object.create(null);
  for (const m of wb.matchAll(/<(?:x:)?sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    const t = targets[m[2]];
    if (!t) continue;
    const trimmed = t.replace(/^\/+/, '');
    const key = trimmed.startsWith('xl/') ? trimmed : `xl/${trimmed}`;
    if (key && e[key]) sheets[decode(m[1])] = parseSheet(e[key], shared);
  }
  return sheets;
}
