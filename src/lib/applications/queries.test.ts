import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CSV_COLUMNS,
  DOCUMENT_TYPES,
  DocumentStatus,
  DocumentType,
  NOT_ON_CHECKLIST_LABEL,
  NOT_STARTED_LABEL,
} from "@/lib/applications/constants";
import { CsvDataError } from "@/lib/applications/csv-repository";
import { getApplication, listApplications } from "@/lib/applications/queries";
import {
  DEFAULT_APPLICATION_SORT,
  SortColumn,
  SortDirection,
  parseApplicationSort,
} from "@/lib/applications/sort";
import {
  SAMPLE_APPLICATION_COUNT,
  SAMPLE_CSV_PATH,
  SAMPLE_FIRST_APPLICATION_ID,
  SAMPLE_LAST_APPLICATION_ID,
  buildRow,
  buildRowsForAllTypes,
  cleanUpCsvFixtures,
  useCsvFixture,
  useSampleCsvFixture,
  toCsv,
} from "@/lib/applications/test-fixtures";

vi.mock("server-only", () => ({}));

const SAMPLE_FIRST_APPLICATION_DOCUMENT_COUNT = 9;
const SAMPLE_FIRST_APPLICATION_MISSING_TYPES = [
  DocumentType.DebtSchedule,
  DocumentType.SbaForm1919,
  DocumentType.SbaForm912,
];

async function countSampleRowsByApplication(): Promise<Map<string, number>> {
  // The sample has no quoted fields (research-notes CSV profile), so a line split is exact.
  const [, ...lines] = (await readFile(SAMPLE_CSV_PATH, "utf8")).split("\n");
  const counts = new Map<string, number>();
  for (const line of lines.filter(Boolean)) {
    const [applicationId] = line.split(",");
    counts.set(applicationId, (counts.get(applicationId) ?? 0) + 1);
  }
  return counts;
}

afterEach(cleanUpCsvFixtures);

describe("queries acceptance", () => {
  it("counts every application in the sample", async () => {
    await useSampleCsvFixture();

    const summaries = await listApplications();

    expect(summaries).toHaveLength(SAMPLE_APPLICATION_COUNT);
  });

  it("counts the documents each application has rows for", async () => {
    await useSampleCsvFixture();
    const expectedCounts = await countSampleRowsByApplication();

    const summaries = await listApplications();

    const actualCounts = new Map(summaries.map((s) => [s.applicationId, s.documentCount]));
    expect(actualCounts.get(SAMPLE_FIRST_APPLICATION_ID)).toBe(SAMPLE_FIRST_APPLICATION_DOCUMENT_COUNT);
    expect(actualCounts).toEqual(expectedCounts);
  });

  it("returns the status of all 12 document types in alphabetical order", async () => {
    await useSampleCsvFixture();

    const detail = await getApplication(SAMPLE_FIRST_APPLICATION_ID);

    const items = detail?.items ?? [];
    const statusByType = new Map(items.map((item) => [item.documentType, item.status]));
    expect(items.map((item) => item.documentType)).toEqual([...DOCUMENT_TYPES].sort());
    expect(statusByType.get(DocumentType.OwnershipVerification)).toBe(DocumentStatus.Approved);
    expect(statusByType.get(DocumentType.BankStatements90Day)).toBe(DocumentStatus.UnderReview);
    expect(statusByType.get(DocumentType.LeaseAgreement)).toBe(DocumentStatus.Pending);
  });

  it("still returns an application missing document types, labelling them Not on checklist", async () => {
    await useSampleCsvFixture();

    const summaries = await listApplications();
    const detail = await getApplication(SAMPLE_FIRST_APPLICATION_ID);

    const missing = (detail?.items ?? []).filter((item) => item.status === NOT_ON_CHECKLIST_LABEL);
    expect(summaries.map((s) => s.applicationId)).toContain(SAMPLE_FIRST_APPLICATION_ID);
    expect(missing.map((item) => item.documentType)).toEqual(SAMPLE_FIRST_APPLICATION_MISSING_TYPES);
    expect(missing.every((item) => item.row === null)).toBe(true);
  });

  it("returns a document with a blank status as Not Started and counts it as outstanding", async () => {
    const rows = buildRowsForAllTypes(DocumentStatus.Approved).map((row) =>
      row.documentType === DocumentType.LeaseAgreement ? { ...row, documentStatus: "" } : row,
    );
    await useCsvFixture(toCsv(rows));

    const detail = await getApplication(rows[0].applicationId);

    const item = detail?.items.find((i) => i.documentType === DocumentType.LeaseAgreement);
    expect(item?.status).toBe(NOT_STARTED_LABEL);
    expect(item?.isSatisfied).toBe(false);
    expect(item?.row?.documentStatus).toBe("");
    expect(detail?.outstandingCount).toBe(1);
  });

  it("returns no applications for a header-only CSV", async () => {
    await useCsvFixture(`${CSV_COLUMNS.join(",")}\n`);

    const summaries = await listApplications();

    expect(summaries).toEqual([]);
  });

  it("returns no applications for a zero-byte CSV", async () => {
    await useCsvFixture("");

    const summaries = await listApplications();

    expect(summaries).toEqual([]);
  });
});

// Sample orders from backend-contract.md I/O Samples, "Unit 5 — order against the sample".
const EARLIEST_APPLIED_IDS = ["APP-2026-1049", "APP-2026-1056"];
const LATEST_APPLIED_ID = "APP-2026-1030";
const FIRST_BUSINESS_ID = "APP-2026-1014";
const SECOND_BUSINESS_ID = "APP-2026-1059";
const LAST_BUSINESS_ID = "APP-2026-1012";
const SECOND_LAST_BUSINESS_ID = "APP-2026-1038";
const APPLIED_AFTER_EARLIEST_ID = "APP-2026-1014";
const APPLIED_TIED_BEFORE_LATEST_IDS = ["APP-2026-1011", "APP-2026-1042"];

async function listIds(column: SortColumn, direction: SortDirection): Promise<string[]> {
  return (await listApplications({ column, direction })).map((s) => s.applicationId);
}

describe("sorting acceptance", () => {
  it("sorts by each column ascending", async () => {
    await useSampleCsvFixture();

    const application = await listIds(SortColumn.Application, SortDirection.Asc);
    const business = await listIds(SortColumn.Business, SortDirection.Asc);
    const applied = await listIds(SortColumn.Applied, SortDirection.Asc);

    expect({
      application: [application[0], application.at(-1)],
      business: [...business.slice(0, 2), business.at(-1)],
      applied: [...applied.slice(0, 3), applied.at(-1)],
    }).toEqual({
      application: [SAMPLE_FIRST_APPLICATION_ID, SAMPLE_LAST_APPLICATION_ID],
      business: [FIRST_BUSINESS_ID, SECOND_BUSINESS_ID, LAST_BUSINESS_ID],
      applied: [...EARLIEST_APPLIED_IDS, APPLIED_AFTER_EARLIEST_ID, LATEST_APPLIED_ID],
    });
  });

  it("sorts by each column descending", async () => {
    await useSampleCsvFixture();

    const application = await listIds(SortColumn.Application, SortDirection.Desc);
    const business = await listIds(SortColumn.Business, SortDirection.Desc);
    const applied = await listIds(SortColumn.Applied, SortDirection.Desc);

    expect({
      application: [application[0], application.at(-1)],
      business: [...business.slice(0, 2), business.at(-1)],
      applied: [...applied.slice(0, 3), ...applied.slice(-2)],
    }).toEqual({
      application: [SAMPLE_LAST_APPLICATION_ID, SAMPLE_FIRST_APPLICATION_ID],
      business: [LAST_BUSINESS_ID, SECOND_LAST_BUSINESS_ID, FIRST_BUSINESS_ID],
      applied: [LATEST_APPLIED_ID, ...APPLIED_TIED_BEFORE_LATEST_IDS, ...EARLIEST_APPLIED_IDS],
    });
  });

  it("returns the same applications whatever the sort", async () => {
    await useSampleCsvFixture();
    const defaultIds = (await listApplications()).map((s) => s.applicationId).sort();
    const combinations = Object.values(SortColumn).flatMap((column) =>
      Object.values(SortDirection).map((direction) => ({ column, direction })),
    );

    const results = await Promise.all(combinations.map((sort) => listApplications(sort)));

    expect(results.map((summaries) => summaries.length)).toEqual(
      combinations.map(() => SAMPLE_APPLICATION_COUNT),
    );
    expect(results.map((summaries) => summaries.map((s) => s.applicationId).sort())).toEqual(
      combinations.map(() => defaultIds),
    );
  });

  it("falls back to the default order when sort and dir are empty or missing", async () => {
    await useSampleCsvFixture();

    const parsed = [parseApplicationSort({}), parseApplicationSort({ sort: "", dir: "" })];
    const ids = (await listApplications()).map((s) => s.applicationId);

    expect(parsed).toEqual([DEFAULT_APPLICATION_SORT, DEFAULT_APPLICATION_SORT]);
    expect(DEFAULT_APPLICATION_SORT).toEqual({
      column: SortColumn.Application,
      direction: SortDirection.Asc,
    });
    expect(ids).toEqual([...ids].sort());
  });
});

describe("listApplications", () => {
  it("groups interleaved rows into one summary per application, sorted by ID", async () => {
    const firstId = "APP-2026-9001";
    const secondId = "APP-2026-9002";
    await useCsvFixture(
      toCsv([
        buildRow({ applicationId: secondId, documentType: DocumentType.DebtSchedule }),
        buildRow({ applicationId: firstId }),
        buildRow({ applicationId: secondId, documentType: DocumentType.LeaseAgreement }),
      ]),
    );

    const summaries = await listApplications();

    expect(summaries.map((s) => [s.applicationId, s.documentCount])).toEqual([
      [firstId, 1],
      [secondId, 2],
    ]);
  });

  it.each([
    ["whole", "390000", 390000],
    ["decimal", "12500.5", 12500.5],
  ])("parses a %s loan amount to a number", async (_label, stored, expected) => {
    await useCsvFixture(toCsv([buildRow({ loanAmount: stored })]));

    const [summary] = await listApplications();

    expect(summary.loanAmount).toBe(expected);
  });
});

describe("getApplication", () => {
  it("returns null for an unknown application ID", async () => {
    await useSampleCsvFixture();

    const detail = await getApplication("APP-2026-0000");

    expect(detail).toBeNull();
  });
});

describe("queries on an unreadable CSV", () => {
  it.each([
    ["listApplications", () => listApplications()],
    ["getApplication", () => getApplication(SAMPLE_FIRST_APPLICATION_ID)],
  ])("%s propagates CsvDataError", async (_label, query) => {
    await useCsvFixture(null);

    await expect(query()).rejects.toBeInstanceOf(CsvDataError);
  });
});
