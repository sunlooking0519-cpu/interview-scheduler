import "server-only";

import ExcelJS from "exceljs";
import { salesExportColumns, type SalesExportColumn } from "@/features/admin/sales-export";

const widths: Record<SalesExportColumn, number> = {
  organization: 34, category: 16, region: 18, visitDate: 16, updatedDate: 18,
  proposalStatus: 18, reaction: 16, contactMethod: 16, contactNames: 24,
  phone: 23, mobile: 23, email: 34, notes: 65,
};

export async function createSalesExportWorkbook(columns: SalesExportColumn[], rows: (string | Date)[][]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Schedule";
  const worksheet = workbook.addWorksheet("기관 목록", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const labels = new Map<string, string>(salesExportColumns.map(([key, label]) => [key, label]));
  worksheet.columns = columns.map((key) => ({
    header: labels.get(key) ?? key, key, width: widths[key],
  }));
  worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  const header = worksheet.getRow(1);
  header.height = 29;
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF163A73" } };
  header.alignment = { vertical: "middle" };
  for (const values of rows) {
    const row = worksheet.addRow(values);
    row.alignment = { vertical: "top", wrapText: true };
    const lines = Math.max(1, ...values.map((value) => typeof value === "string" ? value.split("\n").length : 1));
    row.height = Math.min(100, Math.max(22, lines * 17));
  }
  for (const key of ["visitDate", "updatedDate"] as const) {
    const index = columns.indexOf(key);
    if (index >= 0) worksheet.getColumn(index + 1).numFmt = "yyyy-mm-dd";
  }
  return workbook.xlsx.writeBuffer();
}
