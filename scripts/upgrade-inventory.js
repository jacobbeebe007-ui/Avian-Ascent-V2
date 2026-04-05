#!/usr/bin/env node
/**
 * Consolidated inventory of run upgrades: Stork cards, endless rewards, class perks,
 * passive-pack upgrade lines. Emits JSON (stdout or --out) and optional --csv.
 *
 * Run: node scripts/upgrade-inventory.js [--out dist/upgrade-inventory.json] [--csv]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GAME_JS = path.join(ROOT, 'js', 'core', 'game.js');
const PASSIVE_PACK = path.join(ROOT, 'js', 'data', 'ability_passive_upgrade_pack.js');

function extractArrayBodyAfterMarker(src, marker) {
  const markerIdx = src.indexOf(marker);
  if (markerIdx === -1) return null;
  const openIdx = src.indexOf('[', markerIdx);
  if (openIdx === -1) return null;

  let depth = 0;
  let inString = false;
  let stringQuote = '';
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === stringQuote) {
        inString = false;
        stringQuote = '';
      }
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      stringQuote = ch;
      continue;
    }

    if (ch === '[') depth++;
    if (ch === ']') {
      depth--;
      if (depth === 0) return src.slice(openIdx + 1, i);
    }
  }
  return null;
}

function splitTopLevelBraceObjects(body) {
  const out = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let stringQuote = '';
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    const next = body[i + 1];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === stringQuote) {
        inString = false;
        stringQuote = '';
      }
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      stringQuote = ch;
      continue;
    }

    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
      continue;
    }
    if (ch === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        out.push(body.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return out;
}

function pickQuotedField(src, field) {
  const re = new RegExp(`\\b${field}:\\s*'((?:\\\\'|[^'])*)'`);
  const m = src.match(re);
  return m ? m[1].replace(/\\'/g, "'") : null;
}

function pickDoubleQuotedField(src, field) {
  const re = new RegExp(`\\b${field}:\\s*"((?:\\\\"|[^"])*)"`);
  const m = src.match(re);
  return m ? m[1].replace(/\\"/g, '"') : null;
}

function pickName(src) {
  return pickQuotedField(src, 'name') || pickDoubleQuotedField(src, 'name');
}

function pickTier(src) {
  return pickQuotedField(src, 'tier') || pickQuotedField(src, 'type');
}

function pickStackable(src) {
  const m = src.match(/\bstackable:\s*(true|false)/);
  if (!m) return null;
  return m[1] === 'true';
}

function pickTags(src) {
  const m = src.match(/tags:\s*\[([^\]]*)\]/);
  if (!m) return [];
  const inner = m[1];
  const tags = [];
  const r = /'([^']+)'/g;
  let x;
  while ((x = r.exec(inner))) tags.push(x[1]);
  return tags;
}

function truncate(s, max) {
  if (s == null) return '';
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

function parseArrayUpgradeObjects(category, sourceFile, arrayBody) {
  if (!arrayBody) return [];
  const chunks = splitTopLevelBraceObjects(arrayBody);
  const rows = [];
  for (const obj of chunks) {
    const id =
      pickQuotedField(obj, 'id') ||
      (obj.match(/\bid:\s*"([^"]+)"/) || [])[1];
    if (!id) continue;
    rows.push({
      category,
      id,
      name: pickName(obj) || id,
      tier: pickTier(obj) || '',
      type: pickQuotedField(obj, 'type') || '',
      tags: pickTags(obj),
      stackable: pickStackable(obj),
      sourceFile,
      desc: truncate(pickQuotedField(obj, 'desc') || pickDoubleQuotedField(obj, 'desc') || '', 200),
    });
  }
  return rows;
}

function extractObjectLiteralAfterMarker(src, marker) {
  const markerIdx = src.indexOf(marker);
  if (markerIdx === -1) return null;
  const openIdx = src.indexOf('{', markerIdx);
  if (openIdx === -1) return null;

  let depth = 0;
  let inString = false;
  let stringQuote = '';
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === stringQuote) {
        inString = false;
        stringQuote = '';
      }
      continue;
    }
    if (ch === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      stringQuote = ch;
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(openIdx, i + 1);
    }
  }
  return null;
}

function extractArrayInnerFromOpenBracket(src, openBracketIdx) {
  let depth = 0;
  let inString = false;
  let stringQuote = '';
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = openBracketIdx; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === stringQuote) {
        inString = false;
        stringQuote = '';
      }
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      stringQuote = ch;
      continue;
    }

    if (ch === '[') depth++;
    if (ch === ']') {
      depth--;
      if (depth === 0) return src.slice(openBracketIdx + 1, i);
    }
  }
  return null;
}

function parseClassPerks(gameSrc) {
  const lit = extractObjectLiteralAfterMarker(gameSrc, 'const CLASS_PERK_DEFS =');
  if (!lit) return [];
  const ROLES = ['striker', 'bruiser', 'tank', 'trickster', 'predator', 'singer'];
  const rows = [];
  for (const role of ROLES) {
    const needle = `${role}:`;
    const idx = lit.indexOf(needle);
    if (idx === -1) continue;
    const bracket = lit.indexOf('[', idx);
    if (bracket === -1) continue;
    const arrBody = extractArrayInnerFromOpenBracket(lit, bracket);
    if (arrBody == null) continue;
    const objs = splitTopLevelBraceObjects(arrBody);
    for (const obj of objs) {
      const id = pickQuotedField(obj, 'id');
      if (!id) continue;
      rows.push({
        category: 'class_perk',
        id,
        name: pickName(obj) || id,
        tier: role,
        type: 'class_perk',
        tags: [role],
        stackable: null,
        sourceFile: 'js/core/game.js',
        desc: truncate(pickQuotedField(obj, 'desc') || '', 200),
      });
    }
  }
  return rows;
}

function parsePassivePackUpgradeLines(packSrc) {
  const m = packSrc.match(/const UPGRADE_LINES = Object\.freeze\(\{([\s\S]*?)\}\)/);
  if (!m) return [];
  const inner = m[1];
  const rows = [];
  const abilityNames = {};
  const defBlock = packSrc.match(/const ABILITY_DEFS = Object\.freeze\(\{([\s\S]*?)\}\)/);
  if (defBlock) {
    const idRe = /(\w+)\s*:\s*\{[^}]*\bid:\s*'([^']+)'[^}]*\bname:\s*'([^']*)'/g;
    let dm;
    while ((dm = idRe.exec(defBlock[1]))) {
      abilityNames[dm[2]] = dm[3];
    }
  }

  const lineRe = /(\w+)\s*:\s*\[([^\]]*)\]/g;
  let lm;
  while ((lm = lineRe.exec(inner))) {
    const role = lm[1];
    const ids = [];
    const ir = /'([^']+)'/g;
    let im;
    while ((im = ir.exec(lm[2]))) ids.push(im[1]);
    for (const aid of ids) {
      rows.push({
        category: 'passive_pack_upgrade_line',
        id: `${role}:${aid}`,
        name: abilityNames[aid] || aid,
        tier: '',
        type: role,
        tags: [role, aid],
        stackable: null,
        sourceFile: 'js/data/ability_passive_upgrade_pack.js',
        desc: truncate(`Upgrade line slot: ${aid} (${role})`, 200),
      });
    }
  }
  return rows;
}

function rowsToCsv(rows) {
  const cols = ['category', 'id', 'name', 'tier', 'type', 'tags', 'stackable', 'sourceFile', 'desc'];
  const esc = (v) => {
    if (v == null) return '';
    const s = Array.isArray(v) ? v.join('|') : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [cols.join(',')];
  for (const r of rows) {
    lines.push(cols.map((c) => esc(r[c])).join(','));
  }
  return lines.join('\n');
}

function findDuplicateIds(rows) {
  const byId = new Map();
  for (const r of rows) {
    if (!byId.has(r.id)) byId.set(r.id, []);
    byId.get(r.id).push(r);
  }
  const dups = [];
  for (const [id, list] of byId) {
    if (list.length > 1) {
      const cats = [...new Set(list.map((x) => x.category))];
      dups.push({ id, count: list.length, categories: cats });
    }
  }
  return dups;
}

function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const outfile = outIdx >= 0 ? args[outIdx + 1] : null;
  const wantCsv = args.includes('--csv');

  const gameSrc = fs.readFileSync(GAME_JS, 'utf8');
  const packSrc = fs.readFileSync(PASSIVE_PACK, 'utf8');

  const markers = [
    ['stork_card', 'const UPGRADE_CARDS_REWORK = ['],
    ['endless_augment', 'const ENDLESS_SKILL_AUGMENTS = ['],
    ['endless_relic', 'const ENDLESS_RELICS = ['],
    ['endless_mutation', 'const ENDLESS_MUTATIONS = ['],
  ];

  let rows = [];
  for (const [cat, marker] of markers) {
    const body = extractArrayBodyAfterMarker(gameSrc, marker);
    rows = rows.concat(parseArrayUpgradeObjects(cat, 'js/core/game.js', body));
  }
  rows = rows.concat(parseClassPerks(gameSrc));
  rows = rows.concat(parsePassivePackUpgradeLines(packSrc));

  const dups = findDuplicateIds(rows);
  const payload = {
    generatedAt: new Date().toISOString(),
    counts: {
      total: rows.length,
      byCategory: {},
    },
    duplicateIds: dups,
    items: rows,
  };
  for (const r of rows) {
    payload.counts.byCategory[r.category] = (payload.counts.byCategory[r.category] || 0) + 1;
  }

  const json = JSON.stringify(payload, null, 2);
  if (outfile) {
    const dir = path.dirname(outfile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outfile, json, 'utf8');
    console.error(`Wrote ${outfile} (${rows.length} items)`);
    if (wantCsv) {
      const csvPath = outfile.replace(/\.json$/i, '.csv');
      fs.writeFileSync(csvPath, rowsToCsv(rows), 'utf8');
      console.error(`Wrote ${csvPath}`);
    }
  } else {
    process.stdout.write(json);
    if (wantCsv) {
      console.error('\n--- CSV ---\n');
      process.stderr.write(rowsToCsv(rows));
    }
  }

  if (dups.length) {
    console.error(`Warning: ${dups.length} duplicate id(s) across inventory (see duplicateIds in JSON).`);
  }
}

main();
