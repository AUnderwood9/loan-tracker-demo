import "server-only";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import Papa from "papaparse";
import {
  CSV_COLUMN_BY_FIELD,
  CSV_COLUMNS,
  DOCUMENT_ROW_FIELDS,
  type DocumentRowField,
} from "@/lib/applications/constants";

export const DATA_CSV_PATH_ENV = "DATA_CSV_PATH";
export const DEFAULT_DATA_CSV_PATH = "data/applications.csv";

// Papaparse error rows are 0-based data rows; +1 for the header, +1 for 1-based lines.
// Exact only while no record spans lines or follows a skipped blank line.
const HEADER_LINE_OFFSET = 2;

/** One CSV row, values exactly as stored; blank cells are empty strings. */
export type DocumentRow = Record<DocumentRowField, string>;

export class CsvDataError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CsvDataError";
  }
}

function resolveDataPath(): string {
  return resolve(process.env[DATA_CSV_PATH_ENV] || DEFAULT_DATA_CSV_PATH);
}

function toDocumentRow(record: Record<string, string>): DocumentRow {
  return Object.fromEntries(
    DOCUMENT_ROW_FIELDS.map((field) => [field, record[CSV_COLUMN_BY_FIELD[field]]]),
  ) as DocumentRow;
}

function hasExpectedHeader(fields: readonly string[] | undefined): boolean {
  return (
    fields !== undefined &&
    fields.length === CSV_COLUMNS.length &&
    fields.every((field, index) => field === CSV_COLUMNS[index])
  );
}

// Read on every call, never at module scope: under cacheComponents a module-scope
// read would be treated as build-time data and serve a stale CSV.
export async function readRows(): Promise<DocumentRow[]> {
  const path = resolveDataPath();

  let content: string;
  try {
    content = await readFile(path, "utf8");
  } catch (cause) {
    throw new CsvDataError(`Cannot read data file at ${path}`, { cause });
  }

  if (content.trim() === "") {
    return [];
  }

  const { data, errors, meta } = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
  });

  if (!hasExpectedHeader(meta.fields)) {
    throw new CsvDataError(
      `Unexpected CSV header. Expected: ${CSV_COLUMNS.join(",")}; found: ${meta.fields?.join(",") ?? ""}`,
    );
  }

  const [firstError] = errors;
  if (firstError) {
    const line = (firstError.row ?? 0) + HEADER_LINE_OFFSET;
    throw new CsvDataError(`Malformed CSV row at line ${line}: ${firstError.message}`);
  }

  return data.map(toDocumentRow);
}
