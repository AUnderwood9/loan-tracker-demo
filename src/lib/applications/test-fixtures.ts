import { copyFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import { vi } from "vitest";
import {
  CSV_COLUMNS,
  DOCUMENT_ROW_FIELDS,
  DOCUMENT_TYPES,
  DocumentStatus,
  DocumentType,
} from "@/lib/applications/constants";
import { DATA_CSV_PATH_ENV, type DocumentRow } from "@/lib/applications/csv-repository";
import type { ApplicationSummary } from "@/lib/applications/queries";

export const SAMPLE_CSV_PATH = fileURLToPath(
  new URL("../../../docs/NEWITY_Sample_Data_A_Document_Checklist.csv", import.meta.url),
);
export const SAMPLE_ROW_COUNT = 620;
export const SAMPLE_APPLICATION_COUNT = 60;
export const SAMPLE_FIRST_APPLICATION_ID = "APP-2026-1001";
export const SAMPLE_LAST_APPLICATION_ID = "APP-2026-1060";

const FIXTURE_FILE_NAME = "applications.csv";
const fixtureDirs: string[] = [];

export function buildRow(overrides: Partial<DocumentRow> = {}): DocumentRow {
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

export function buildSummary(overrides: Partial<ApplicationSummary> = {}): ApplicationSummary {
  return {
    applicationId: "APP-2026-9001",
    businessName: "Test Bakery",
    borrowerName: "Test Borrower",
    loanAmount: 100000,
    applicationDate: "1/5/2026",
    assignedProcessor: "Test Processor",
    documentCount: 1,
    outstandingCount: 12,
    isComplete: false,
    ...overrides,
  };
}

export function buildRowsForAllTypes(
  status: string,
  overrides: Partial<DocumentRow> = {},
): DocumentRow[] {
  return DOCUMENT_TYPES.map((documentType) =>
    buildRow({ ...overrides, documentType, documentStatus: status }),
  );
}

export function toCsv(rows: DocumentRow[]): string {
  return Papa.unparse(
    {
      fields: [...CSV_COLUMNS],
      data: rows.map((row) => DOCUMENT_ROW_FIELDS.map((field) => row[field])),
    },
    { newline: "\n" },
  );
}

async function createFixtureDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "loan-tracker-test-"));
  fixtureDirs.push(dir);
  return dir;
}

/** Points the repository at a temp-dir path, written with `content` unless it is null. */
export async function useCsvFixture(content: string | null): Promise<string> {
  const path = join(await createFixtureDir(), FIXTURE_FILE_NAME);
  if (content !== null) {
    await writeFile(path, content, "utf8");
  }
  vi.stubEnv(DATA_CSV_PATH_ENV, path);
  return path;
}

export async function useSampleCsvFixture(): Promise<string> {
  const path = join(await createFixtureDir(), FIXTURE_FILE_NAME);
  await copyFile(SAMPLE_CSV_PATH, path);
  vi.stubEnv(DATA_CSV_PATH_ENV, path);
  return path;
}

export async function cleanUpCsvFixtures(): Promise<void> {
  vi.unstubAllEnvs();
  const dirs = fixtureDirs.splice(0);
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
}
