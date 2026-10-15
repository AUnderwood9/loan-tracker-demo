import { readFile, stat } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CSV_COLUMNS,
  DOCUMENT_ROW_FIELDS,
  DocumentStatus,
  DocumentType,
} from "@/lib/applications/constants";
import { CsvDataError, readRows } from "@/lib/applications/csv-repository";
import {
  SAMPLE_FIRST_APPLICATION_ID,
  SAMPLE_ROW_COUNT,
  buildRow,
  cleanUpCsvFixtures,
  toCsv,
  useCsvFixture,
  useSampleCsvFixture,
} from "@/lib/applications/test-fixtures";

vi.mock("server-only", () => ({}));

const SAMPLE_FIRST_BUSINESS_NAME = "Metro Dental Group";

afterEach(cleanUpCsvFixtures);

describe("readRows acceptance", () => {
  it("reads every row of the sample CSV with all 11 fields, in file order", async () => {
    await useSampleCsvFixture();

    const rows = await readRows();

    expect(rows).toHaveLength(SAMPLE_ROW_COUNT);
    expect(new Set(rows.map((row) => Object.keys(row).join()))).toEqual(
      new Set([DOCUMENT_ROW_FIELDS.join()]),
    );
    expect(rows[0]).toMatchObject({
      applicationId: SAMPLE_FIRST_APPLICATION_ID,
      businessName: SAMPLE_FIRST_BUSINESS_NAME,
      documentType: DocumentType.BankStatements90Day,
      documentStatus: DocumentStatus.UnderReview,
    });
  });
});

describe("readRows", () => {
  const header = CSV_COLUMNS.join(",");
  const validDataLine = toCsv([buildRow()]).split("\n")[1];

  it("returns blank cells as empty strings", async () => {
    await useCsvFixture(toCsv([buildRow({ documentStatus: "", dateReceived: "", notes: "" })]));

    const [row] = await readRows();

    expect([row.documentStatus, row.dateReceived, row.notes]).toEqual(["", "", ""]);
  });

  it("parses a quoted field containing a comma, a double quote and a newline", async () => {
    const notes = 'Called borrower, left "urgent" msg\nfollow up Friday';
    await useCsvFixture(toCsv([buildRow({ notes })]));

    const [row] = await readRows();

    expect(row.notes).toBe(notes);
  });

  it("throws CsvDataError when the file is missing", async () => {
    await useCsvFixture(null);

    await expect(readRows()).rejects.toBeInstanceOf(CsvDataError);
  });

  it.each([
    ["a renamed column", header.replace(CSV_COLUMNS[0], "app_id")],
    ["reordered columns", [CSV_COLUMNS[1], CSV_COLUMNS[0], ...CSV_COLUMNS.slice(2)].join(",")],
    ["a missing column", CSV_COLUMNS.slice(1).join(",")],
  ])("throws CsvDataError for a header with %s", async (_label, badHeader) => {
    await useCsvFixture(`${badHeader}\n`);

    await expect(readRows()).rejects.toBeInstanceOf(CsvDataError);
  });

  it("throws CsvDataError naming the line of a row with too few fields", async () => {
    const shortLine = validDataLine.slice(0, validDataLine.lastIndexOf(","));
    await useCsvFixture(`${header}\n${validDataLine}\n${shortLine}\n`);

    const error = await readRows().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CsvDataError);
    expect((error as CsvDataError).message).toContain("line 3");
  });

  it.each([
    ["too many fields", `${validDataLine},extra`],
    ["an unterminated quote", `${validDataLine.slice(0, -1)}"unterminated`],
  ])("throws CsvDataError for a row with %s", async (_label, badLine) => {
    await useCsvFixture(`${header}\n${badLine}\n`);

    await expect(readRows()).rejects.toBeInstanceOf(CsvDataError);
  });

  it("does not modify the file", async () => {
    const path = await useSampleCsvFixture();
    const before = { content: await readFile(path, "utf8"), mtimeMs: (await stat(path)).mtimeMs };

    await readRows();

    const after = { content: await readFile(path, "utf8"), mtimeMs: (await stat(path)).mtimeMs };
    expect(after).toEqual(before);
  });
});
