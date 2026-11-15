"""Build the idempotent Supabase import from the supplied school workbook."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from collections import Counter

import openpyxl


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "imports" / "school-management" / "담당_학교목록.xlsx"
OUTPUT = ROOT / "supabase" / "school-management-data.sql"
EXPECTED_HEADERS = ("광역지역", "지역", "학교급", "학교명", "대표전화번호")


def normalized(value: object) -> str:
    return " ".join(str(value if value is not None else "").split())


def sql_string(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


workbook = openpyxl.load_workbook(SOURCE, read_only=True, data_only=True)
schools = list(workbook["학교목록"].values)
evidence = list(workbook["학교별 근거"].values)
if tuple(schools[0][:5]) != EXPECTED_HEADERS or tuple(evidence[0][:5]) != EXPECTED_HEADERS:
    raise ValueError("Unexpected workbook headers")
if len(schools) != len(evidence) or len(schools) != 1004:
    raise ValueError("The school and evidence sheets must contain the same 1,003 schools")

rows: list[tuple[str, ...]] = []
keys: list[tuple[str, str, str]] = []
for sheet_row, evidence_row in zip(schools[1:], evidence[1:], strict=True):
    visible = tuple(normalized(value) for value in sheet_row[:5])
    if visible != tuple(normalized(value) for value in evidence_row[:5]):
        raise ValueError(f"Mismatched evidence for {visible[3]}")
    province, district, level, name, phone = visible
    office_code, school_code = normalized(evidence_row[5]), normalized(evidence_row[6])
    loaded_on = datetime.strptime(normalized(evidence_row[10]), "%Y%m%d").date().isoformat()
    if not all((province, district, level, name, phone, office_code, school_code)):
        raise ValueError(f"Incomplete school row: {visible}")
    keys.append((office_code, school_code, level))
    rows.append((office_code, school_code, province, district, level, name, phone, loaded_on))
if any(count != 1 for count in Counter(keys).values()):
    raise ValueError("Duplicate school source keys")

lines = [
    "-- Generated from imports/school-management/담당_학교목록.xlsx; run after school-management-migration.sql.",
    "-- Re-running updates public school details and preserves existing assignments.",
    "begin;",
]
columns = "education_office_code,school_code,province,district,level,name,phone,source_loaded_on"
for offset in range(0, len(rows), 100):
    lines.append(f"insert into scheduler.schools ({columns}) values")
    lines.append(",\n".join(
        "  (" + ",".join(sql_string(value) for value in row[:-1]) + f",{sql_string(row[-1])}::date)"
        for row in rows[offset : offset + 100]
    ))
    lines.extend([
        "on conflict (education_office_code,school_code,level) do update set",
        "  province = excluded.province, district = excluded.district, name = excluded.name,",
        "  phone = excluded.phone, source_loaded_on = excluded.source_loaded_on, updated_at = now()",
        "where (scheduler.schools.province, scheduler.schools.district, scheduler.schools.name,",
        "       scheduler.schools.phone, scheduler.schools.source_loaded_on) is distinct from",
        "      (excluded.province, excluded.district, excluded.name, excluded.phone, excluded.source_loaded_on);",
    ])
lines.extend([
    "commit;",
    "select count(*) as imported_school_count from scheduler.schools;",
    "",
])
OUTPUT.write_text("\n".join(lines), encoding="utf-8")
print(f"Generated {OUTPUT.name}: {len(rows)} schools, {len(Counter(r[2] for r in rows))} provinces, "
      f"{len(set((r[2], r[3]) for r in rows))} districts")
