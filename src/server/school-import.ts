import "server-only";

import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import JSZip from "jszip";

export type ImportedSchool = {
  education_office_code: string; school_code: string; province: string;
  district: string; level: string; name: string; phone: string; source_loaded_on: string;
  sourceRow?: number;
};
export type ExistingSchool = ImportedSchool & { id: string };
export type ImportIssue = { row: number; message: string };
export type ImportComparison = {
  added: ImportedSchool[]; changed: ImportedSchool[]; unchanged: number; issues: ImportIssue[];
};

const headers = ["광역지역", "지역", "학교급", "학교명", "대표전화번호"];
const levels = new Set(["초등학교", "중학교", "고등학교"]);
const normalized = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ");
const key = (row: Pick<ImportedSchool, "education_office_code" | "school_code" | "level">) =>
  `${row.education_office_code}\u0000${row.school_code}\u0000${row.level}`;
const identity = (row: Pick<ImportedSchool, "province" | "district" | "level" | "name">) =>
  `${row.province}\u0000${row.district}\u0000${row.level}\u0000${row.name}`;
const sourceDate = (value: string) => {
  const match = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(value);
  if (!match) return "";
  const result = `${match[1]}-${match[2]}-${match[3]}`;
  const date = new Date(`${result}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().startsWith(result) ? result : "";
};
const cell = (row: ExcelJS.Row, index: number) => normalized(row.getCell(index).text);

export async function parseSchoolWorkbook(buffer: Buffer): Promise<{ rows: ImportedSchool[]; issues: ImportIssue[]; digest: string }> {
  const digest = createHash("sha256").update(buffer).digest("hex");
  const workbook = new ExcelJS.Workbook();
  // The supplied workbook uses an x: prefix for OOXML's main namespace; ExcelJS
  // expects the same namespace as the default namespace.
  const zip = await JSZip.loadAsync(buffer);
  for (const [name, entry] of Object.entries(zip.files)) {
    if (!name.startsWith("xl/") || !name.endsWith(".xml") || entry.dir) continue;
    const xml = await entry.async("string");
    if (xml.length > 20 * 1024 * 1024) throw new Error("엑셀 시트가 너무 큽니다.");
    let compatible = xml;
    if (xml.includes('xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'))
      compatible = compatible.replaceAll('xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"', 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"').replace(/<(\/?)(x:)/g, "<$1");
    if (name.startsWith("xl/worksheets/")) compatible = compatible.replace(/<tableParts\b[^>]*>[\s\S]*?<\/tableParts>/g, "");
    if (compatible !== xml) zip.file(name, compatible);
  }
  const compatibleBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  await workbook.xlsx.load(compatibleBuffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const visible = workbook.getWorksheet("학교목록");
  const evidence = workbook.getWorksheet("학교별 근거");
  if (!visible || !evidence) throw new Error("'학교목록'과 '학교별 근거' 시트가 모두 필요합니다.");
  for (const sheet of [visible, evidence]) {
    if (headers.some((label, index) => cell(sheet.getRow(1), index + 1) !== label))
      throw new Error(`${sheet.name} 시트의 첫 행 제목이 기존 담당_학교목록.xlsx 형식과 다릅니다.`);
  }
  if (cell(evidence.getRow(1), 6) !== "교육청코드" || cell(evidence.getRow(1), 7) !== "학교코드")
    throw new Error("'학교별 근거' 시트의 교육청코드와 학교코드가 필요합니다.");
  if (visible.rowCount > 5001 || evidence.rowCount > 5001)
    throw new Error("한 번에 최대 5,000개 학교까지 업로드할 수 있습니다.");

  const issues: ImportIssue[] = [];
  const evidenceByIdentity = new Map<string, { code: string; office: string; loaded: string; phone: string }>();
  for (let index = 2; index <= evidence.rowCount; index++) {
    const row = evidence.getRow(index);
    if (headers.every((_, column) => !cell(row, column + 1))) continue;
    const [province, district, level, name, phone] = headers.map((_, column) => cell(row, column + 1));
    const source = { province, district, level, name };
    const id = identity(source);
    if (evidenceByIdentity.has(id)) { issues.push({ row: index, message: `학교별 근거에 ${name}이(가) 중복됩니다.` }); continue; }
    evidenceByIdentity.set(id, { office: cell(row, 6), code: cell(row, 7), loaded: cell(row, 11), phone });
  }
  const rows: ImportedSchool[] = [];
  const seen = new Set<string>();
  const seenCodes = new Set<string>();
  for (let index = 2; index <= visible.rowCount; index++) {
    const row = visible.getRow(index);
    if (headers.every((_, column) => !cell(row, column + 1))) continue;
    const [province, district, level, name, phone] = headers.map((_, column) => cell(row, column + 1));
    const evidenceRow = evidenceByIdentity.get(identity({ province, district, level, name }));
    if (!province || !district || !levels.has(level) || !name || !phone) {
      issues.push({ row: index, message: "지역·학교급·학교명·대표전화번호를 확인해 주세요." }); continue;
    }
    if (!evidenceRow) { issues.push({ row: index, message: `${name}: 학교별 근거 시트에서 같은 학교를 찾지 못했습니다.` }); continue; }
    const loaded = sourceDate(evidenceRow.loaded);
    if (!evidenceRow.office || !evidenceRow.code || !loaded || evidenceRow.phone !== phone) {
      issues.push({ row: index, message: `${name}: 학교코드·자료 기준일·대표전화번호가 근거 시트와 일치하는지 확인해 주세요.` }); continue;
    }
    const school = { education_office_code: evidenceRow.office, school_code: evidenceRow.code,
      province, district, level, name, phone, source_loaded_on: loaded, sourceRow: index };
    if (seen.has(key(school))) { issues.push({ row: index, message: `${name}: 동일한 학교코드가 중복됩니다.` }); continue; }
    const code = `${school.education_office_code}\u0000${school.school_code}`;
    if (seenCodes.has(code)) { issues.push({ row: index, message: `${name}: 같은 학교코드가 다른 학교급에 중복됩니다.` }); continue; }
    seen.add(key(school));
    seenCodes.add(code);
    rows.push(school);
  }
  if (!rows.length && !issues.length) throw new Error("학교목록 시트에 업로드할 학교가 없습니다.");
  return { rows, issues, digest };
}

export function compareSchoolImport(rows: ImportedSchool[], existing: ExistingSchool[]): ImportComparison {
  const byKey = new Map(existing.map((row) => [key(row), row]));
  const byCode = new Map(existing.map((row) => [`${row.education_office_code}\u0000${row.school_code}`, row]));
  const byIdentity = new Map(existing.map((row) => [identity(row), row]));
  const added: ImportedSchool[] = [];
  const changed: ImportedSchool[] = [];
  const issues: ImportIssue[] = [];
  let unchanged = 0;
  rows.forEach((row, index) => {
    const old = byKey.get(key(row));
    if (!old && byCode.has(`${row.education_office_code}\u0000${row.school_code}`)) {
      issues.push({ row: row.sourceRow ?? index + 2, message: `${row.name}: 기존 학교코드의 학교급이 달라 확인이 필요합니다.` }); return;
    }
    if (!old && byIdentity.has(identity(row))) {
      issues.push({ row: row.sourceRow ?? index + 2, message: `${row.name}: 같은 이름·지역의 기존 학교와 코드가 다릅니다.` }); return;
    }
    if (!old) { added.push(row); return; }
    if (old.source_loaded_on && old.source_loaded_on > row.source_loaded_on) {
      issues.push({ row: row.sourceRow ?? index + 2, message: `${row.name}: 업로드 파일의 자료 기준일이 DB보다 오래됐습니다.` }); return;
    }
    if (["province", "district", "name", "phone", "source_loaded_on"].some((field) => old[field as keyof ImportedSchool] !== row[field as keyof ImportedSchool])) changed.push(row);
    else unchanged++;
  });
  return { added, changed, unchanged, issues };
}

export function importFingerprint(digest: string, existing: ExistingSchool[]) {
  return createHash("sha256").update(digest).update(JSON.stringify(existing.map((row) => [
    row.education_office_code, row.school_code, row.level, row.province, row.district,
    row.name, row.phone, row.source_loaded_on,
  ]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))).digest("hex");
}
