#!/usr/bin/env python3
"""Sync GitHub master workbook Bird Stats from runtime js/data/birds-v2.js.

Patches Avian_Ascent_Current_Master_v1.6_Structured_Effects.xlsm in place
(zip/XML) so drawings, macros layout, and the Node OOXML importer stay intact.
"""
from __future__ import annotations

import json
import re
import sys
import zipfile
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
BIRDS_V2 = ROOT / "js" / "data" / "birds-v2.js"
WORKBOOK = ROOT / "Avian_Ascent_Current_Master_v1.6_Structured_Effects.xlsm"
NEW_HEADERS = [
    ("AE", "L1 Max Health", "14.0", "3"),
    ("AF", "Base Precision", "14.0", "3"),
    ("AG", "Class Precision", "16.0", "3"),
    ("AH", "Size Precision Modifier", "20.0", "3"),
    ("AI", "Species Precision Modifier", "22.0", "3"),
    ("AJ", "Precision Identity", "36.0", "17"),
]
SHARED_REPLACEMENTS = {
    "Each +1 Vitality increases maximum health by 5% of Base Health.":
        "Each +1 Vitality increases Max Health by 3 (flat).",
    "Apply after determining the bird’s developed Base Health.":
        "L1 Max Health = Base Health + Vitality × 3. Later levels add ½ original Base Health before Vitality.",
    "+5% Base Health per point":
        "+3 Max Health per point",
    "Max Health = Base Health × (1 + 0.05 × Final Vitality)":
        "Max Health = Leveled Base Health + Final Vitality × 3",
    "Buffs change flat Vitality first.":
        "Leveled Base Health = Base Health + (level − 1) × (Base Health × 0.5).",
    "Developed Base Health × (1 + 0.05 × Final Vitality)":
        "Developed Base Health + Final Vitality × 3",
    "Vitality scales base health only":
        "Vitality grants flat Max Health",
    "40 × 1.60 = 64":
        "Sparrow L1: 10 + 3×3 = 19",
    "Convert Final Vitality to Base Health increase":
        "Convert Final Vitality to Max Health",
    "Base Health × (1 + 0.05 × Vitality)":
        "Leveled Base Health + Vitality × 3",
    "Vitality increases Base Health.":
        "Vitality increases Max Health.",
    "Base Health × (1 + Vitality×0.05)":
        "Base Health + Vitality × 3",
    "10 Base Health, 4 Vitality = 12 Health":
        "10 Base Health, 3 Vitality = 19 Health",
    "Low starting Health with meaningful investment.":
        "Low starting Health with a visible +3 HP per Vitality.",
    "Bird Base Stats and Passive/Perk Summaries — v1.0":
        "Bird Base Stats — current runtime (birds-v2)",
    "All 52 birds use low Base Health by size and pre-built tier-budgeted attributes. These same rows are authoritative for player birds and NPC/enemy birds.":
        "All 52 birds: size Base Health, tier-budgeted attributes, L1 Max Health (Base Health + Vitality × 3), Dodge (Agility × 0.5%), and Base Precision (class + size + species). Player and NPC birds share these rows.",
    "Current bird, class, progression and combat data combined with Equipment System v1.2 restoration, Fortify, Ward and cooldown rules.":
        "Current bird, class, progression and combat data. Bird Stats rows match runtime js/data/birds-v2.js (attributes, L1 Max Health, Base Precision).",
    "Confirmed v0.8 conversions. Core equipment attributes are flat-only.":
        "Current runtime conversions. Core equipment attributes are flat-only. Vitality is +3 Max Health per point.",
    "Combat Scaling Model v0.8":
        "Combat Scaling Model — current runtime",
    "The active pipeline centralises all confirmed conversions and removes percentage core equipment.":
        "Active pipeline. Health conversion is Base Health + Vitality × 3 (not 5% of Base Health).",
    "The active v0.8 rules. Older conflicting values in legacy snapshots are superseded by this register.":
        "The active rules. Vitality→Max Health is the current runtime conversion (+3 HP per Vitality). Older 5%-of-Base-Health snapshots are superseded.",
    "Direct flat-health effects, if any, apply separately after this step.":
        "+1 Vitality always adds +3 Max Health after rounding.",
}


def load_birds_v2():
    src = BIRDS_V2.read_text(encoding="utf-8")
    start = src.index("{", src.index("Object.freeze("))
    depth = 0
    end = None
    for i, ch in enumerate(src[start:], start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    if end is None:
        raise RuntimeError("could not parse birds-v2.js JSON")
    data = json.loads(src[start:end])
    by_name = {row["name"]: row for row in data.values()}
    if len(by_name) != 52:
        raise RuntimeError(f"expected 52 bird names, got {len(by_name)}")
    return by_name


def parse_shared_strings(xml: str):
    items = re.findall(r"<si\b[^>]*>([\s\S]*?)</si>", xml)
    texts = []
    for body in items:
        texts.append("".join(re.findall(r"<t[^>]*>([\s\S]*?)</t>", body)))
    return texts


def unescape(s: str) -> str:
    return (s.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"')
            .replace("&apos;", "'").replace("&#10;", "\n").replace("&amp;", "&"))


def append_shared_string(xml: str, text: str) -> tuple[str, int]:
    texts = parse_shared_strings(xml)
    idx = len(texts)
    node = f"<si><t xml:space=\"preserve\">{escape(text)}</t></si>"
    if not xml.rstrip().endswith("</sst>"):
        raise RuntimeError("sharedStrings.xml missing </sst>")
    xml = re.sub(r"</sst>\s*$", node + "</sst>", xml, count=1)
    xml = re.sub(
        r'(<sst\b[^>]*\buniqueCount=")(\d+)(")',
        lambda m: f'{m.group(1)}{int(m.group(2)) + 1}{m.group(3)}',
        xml, count=1,
    )
    xml = re.sub(
        r'(<sst\b[^>]*\bcount=")(\d+)(")',
        lambda m: f'{m.group(1)}{int(m.group(2)) + 1}{m.group(3)}',
        xml, count=1,
    )
    return xml, idx


def replace_shared_text(xml: str, old: str, new: str) -> str:
    pattern = f"<t>{re.escape(escape(old))}</t>"
    repl = f"<t>{escape(new)}</t>"
    updated, n = re.subn(pattern, repl, xml, count=1)
    if n != 1:
        # try without escape differences (already-escaped old)
        pattern2 = f"<t>{re.escape(old)}</t>"
        updated, n = re.subn(pattern2, repl, xml, count=1)
    if n != 1:
        raise RuntimeError(f"shared string not found uniquely: {old[:80]!r} (n={n})")
    return updated


def set_number_cell(sheet: str, ref: str, value) -> str:
    pat = rf'(<c r="{ref}"[^>]*>\s*<v>)([^<]*)(</v>)'
    updated, n = re.subn(pat, lambda m: f"{m.group(1)}{value}{m.group(3)}", sheet, count=1)
    if n != 1:
        raise RuntimeError(f"numeric cell {ref} not found")
    return updated


def insert_before_row_end(sheet: str, row: int, extra: str) -> str:
    pat = rf'(<row r="{row}"[^>]*>[\s\S]*?)(</row>)'
    updated, n = re.subn(pat, lambda m: m.group(1) + extra + m.group(2), sheet, count=1)
    if n != 1:
        raise RuntimeError(f"row {row} not found")
    return updated


def cell_shared(ref: str, idx: int, style: str) -> str:
    return f'<c r="{ref}" s="{style}" t="s"><v>{idx}</v></c>'


def cell_number(ref: str, value, style: str = "4") -> str:
    return f'<c r="{ref}" s="{style}"><v>{value}</v></c>'


def bird_name_at_row(sheet: str, shared_texts: list[str], row: int) -> str:
    m = re.search(rf'<c r="A{row}"[^>]*t="s"[^>]*><v>(\d+)</v>', sheet)
    if not m:
        m = re.search(rf'<c r="A{row}" t="s" s="\d+"><v>(\d+)</v>', sheet)
    if not m:
        raise RuntimeError(f"Bird Name cell A{row} not found")
    return unescape(shared_texts[int(m.group(1))])


def patch_bird_stats(sheet: str, shared_xml: str, by_name: dict) -> tuple[str, str]:
    shared_texts = [unescape(t) for t in parse_shared_strings(shared_xml)]
    header_extra = []
    for letter, title, _width, style in NEW_HEADERS:
        shared_xml, idx = append_shared_string(shared_xml, title)
        header_extra.append(cell_shared(f"{letter}4", idx, style))
    sheet = insert_before_row_end(sheet, 4, "".join(header_extra))

    identity_index = {}
    for row in range(5, 57):
        name = bird_name_at_row(sheet, shared_texts, row)
        if name not in by_name:
            raise RuntimeError(f"row {row}: {name!r} not in birds-v2.js")
        bird = by_name[name]
        st = bird["stats"]
        sheet = set_number_cell(sheet, f"H{row}", int(bird["baseHealth"]))
        sheet = set_number_cell(sheet, f"I{row}", int(bird["vitality"]))
        sheet = set_number_cell(sheet, f"J{row}", int(st["atk"]))
        sheet = set_number_cell(sheet, f"K{row}", int(st["dex"]))
        sheet = set_number_cell(sheet, f"L{row}", int(st["def"]))
        sheet = set_number_cell(sheet, f"M{row}", int(st["matk"]))
        sheet = set_number_cell(sheet, f"N{row}", int(st["mdef"]))
        sheet = set_number_cell(sheet, f"O{row}", int(st["spd"]))
        crit = st["critChance"]
        sheet = set_number_cell(sheet, f"Q{row}", (crit / 100.0) if crit > 1 else crit)
        sheet = set_number_cell(sheet, f"R{row}", float(bird["critDamage"]))
        ident = bird.get("precisionIdentity") or ""
        if ident not in identity_index:
            shared_xml, identity_index[ident] = append_shared_string(shared_xml, ident)
        extra = "".join([
            cell_number(f"AE{row}", int(st["maxHp"])),
            cell_number(f"AF{row}", int(bird.get("basePrecision") or st.get("acc") or 0)),
            cell_number(f"AG{row}", int(bird.get("classPrecision") or 0)),
            cell_number(f"AH{row}", int(bird.get("sizePrecisionModifier") or 0)),
            cell_number(f"AI{row}", int(bird.get("speciesPrecisionModifier") or 0)),
            cell_shared(f"AJ{row}", identity_index[ident], "4"),
        ])
        sheet = insert_before_row_end(sheet, row, extra)

    col_xml = "".join(
        f'<col customWidth="1" min="{31 + i}" max="{31 + i}" width="{width}"/>'
        for i, (_letter, _title, width, _style) in enumerate(NEW_HEADERS)
    )
    if "</cols>" not in sheet:
        raise RuntimeError("Bird Stats missing </cols>")
    sheet = sheet.replace("</cols>", col_xml + "</cols>", 1)
    sheet = sheet.replace('ref="A1:AD1"', 'ref="A1:AJ1"')
    sheet = sheet.replace('ref="A2:U2"', 'ref="A2:AJ2"')
    print(f"[sync-workbook-bird-stats] Bird Stats: 52 birds, added L1 Max Health + Precision columns")
    return sheet, shared_xml


def rewrite_zip(path: Path, updates: dict[str, str]) -> None:
    buf = BytesIO()
    with zipfile.ZipFile(path, "r") as src, zipfile.ZipFile(buf, "w") as dst:
        for info in src.infolist():
            data = updates.get(info.filename, src.read(info.filename))
            if isinstance(data, str):
                data = data.encode("utf-8")
            new_info = zipfile.ZipInfo(filename=info.filename, date_time=info.date_time)
            new_info.compress_type = info.compress_type
            new_info.external_attr = info.external_attr
            dst.writestr(new_info, data)
    path.write_bytes(buf.getvalue())


def main():
    if not WORKBOOK.exists():
        raise SystemExit(f"missing workbook: {WORKBOOK}")
    by_name = load_birds_v2()
    with zipfile.ZipFile(WORKBOOK) as z:
        shared = z.read("xl/sharedStrings.xml").decode("utf-8")
        bird_sheet = z.read("xl/worksheets/sheet9.xml").decode("utf-8")

    for old, new in SHARED_REPLACEMENTS.items():
        shared = replace_shared_text(shared, old, new)
        print(f"  updated rule text: {old[:48]}…")

    bird_sheet, shared = patch_bird_stats(bird_sheet, shared, by_name)
    rewrite_zip(WORKBOOK, {
        "xl/sharedStrings.xml": shared,
        "xl/worksheets/sheet9.xml": bird_sheet,
    })
    print(f"[sync-workbook-bird-stats] wrote {WORKBOOK.name}")


if __name__ == "__main__":
    try:
        main()
    except Exception as err:
        print(f"[sync-workbook-bird-stats] FAIL: {err}", file=sys.stderr)
        sys.exit(1)
