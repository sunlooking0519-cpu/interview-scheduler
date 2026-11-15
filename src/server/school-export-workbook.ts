import "server-only";

import ExcelJS from "exceljs";
import { schoolExportColumns, type SchoolExportActivity, type SchoolExportColumn, type SchoolExportRecord, buildSchoolExportRows, buildSchoolActivityRows } from "@/features/admin/school-export";

const widths: Record<SchoolExportColumn, number> = {
  name: 32, province: 18, district: 18, level: 14, phone: 21,
  contactName: 20, contactPhone: 21, contactEmail: 34, contactDate: 17,
  updatedDate: 18, contactMethod: 16, proposalStatus: 18, reaction: 16,
  notes: 65, activityCount: 16, sourceLoadedOn: 19, assignedAt: 20,
};
const activityHeaders = [
  "학교명", "광역지역", "지역", "접촉일", "접촉 방식", "학교 담당자", "담당자 전화번호",
  "담당자 이메일", "제안서 제출", "반응", "특이사항 · 상담 내용", "업데이트 날짜", "기록 시각", "수정 시각",
];
const activityWidths = [32, 18, 18, 17, 16, 20, 21, 34, 18, 16, 65, 18, 23, 23];

function decorate(sheet: ExcelJS.Worksheet, rows: (string | number | Date)[][]) {
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
  const header = sheet.getRow(1);
  header.height = 29;
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF163A73" } };
  header.alignment = { vertical: "middle" };
  for (const values of rows) {
    const row = sheet.addRow(values);
    row.alignment = { vertical: "top", wrapText: true };
    const lines = Math.max(1, ...values.map((value) => typeof value === "string" ? value.split("\n").length : 1));
    row.height = Math.min(100, Math.max(22, lines * 17));
  }
}

export async function createSchoolExportWorkbook(
  columns: SchoolExportColumn[], schools: SchoolExportRecord[], activities: SchoolExportActivity[], includeHistory: boolean,
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Schedule";
  const schoolSheet = workbook.addWorksheet("학교 목록", { views: [{ state: "frozen", ySplit: 1 }] });
  const labels = new Map<string, string>(schoolExportColumns.map(([key, label]) => [key, label]));
  schoolSheet.columns = columns.map((key) => ({ header: labels.get(key) ?? key, key, width: widths[key] }));
  decorate(schoolSheet, buildSchoolExportRows(schools, activities, columns));
  for (const key of ["contactDate", "updatedDate", "sourceLoadedOn"] as const) {
    const index = columns.indexOf(key);
    if (index >= 0) schoolSheet.getColumn(index + 1).numFmt = "yyyy-mm-dd";
  }
  const assignedIndex = columns.indexOf("assignedAt");
  if (assignedIndex >= 0) schoolSheet.getColumn(assignedIndex + 1).numFmt = "yyyy-mm-dd hh:mm";

  if (includeHistory) {
    const activitySheet = workbook.addWorksheet("활동 기록", { views: [{ state: "frozen", ySplit: 1 }] });
    activitySheet.columns = activityHeaders.map((header, index) => ({ header, width: activityWidths[index] }));
    decorate(activitySheet, buildSchoolActivityRows(schools, activities));
    for (const index of [4, 12]) activitySheet.getColumn(index).numFmt = "yyyy-mm-dd";
    for (const index of [13, 14]) activitySheet.getColumn(index).numFmt = "yyyy-mm-dd hh:mm";
  }
  return workbook.xlsx.writeBuffer();
}
