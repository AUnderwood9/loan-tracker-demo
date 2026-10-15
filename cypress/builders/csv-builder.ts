import {
  CSV_COLUMNS,
  DOCUMENT_ROW_FIELDS,
  DOCUMENT_TYPES,
  DocumentStatus,
  DocumentType,
  type DocumentRowField,
} from "../../src/lib/applications/constants";

export type CsvRow = Record<DocumentRowField, string>;

export function buildRow(overrides: Partial<CsvRow> = {}): CsvRow {
  return {
    applicationId: "APP-2026-9001",
    businessName: "Test Bakery",
    borrowerName: "Test Borrower",
    loanAmount: "100000",
    applicationDate: "1/5/2026",
    assignedProcessor: "Test Processor",
    documentType: DocumentType.ArticlesOfIncorporation,
    documentStatus: DocumentStatus.Pending,
    dateReceived: "",
    expirationDate: "",
    notes: "",
    ...overrides,
  };
}

export function buildRowsForAllTypes(status: string, overrides: Partial<CsvRow> = {}): CsvRow[] {
  return DOCUMENT_TYPES.map((documentType) =>
    buildRow({ ...overrides, documentType, documentStatus: status }),
  );
}

function quoteCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function toCsv(rows: readonly CsvRow[]): string {
  const lines = rows.map((row) => DOCUMENT_ROW_FIELDS.map((field) => quoteCell(row[field])).join(","));
  return [CSV_COLUMNS.join(","), ...lines].join("\n") + "\n";
}

export function buildHeaderOnlyCsv(): string {
  return toCsv([]);
}

export function buildBadHeaderCsv(): string {
  const [firstColumn, ...rest] = CSV_COLUMNS;
  const header = [`${firstColumn}_renamed`, ...rest].join(",");
  return `${header}\n${DOCUMENT_ROW_FIELDS.map((field) => buildRow()[field]).join(",")}\n`;
}
