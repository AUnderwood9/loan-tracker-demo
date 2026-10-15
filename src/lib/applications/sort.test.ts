import { describe, expect, it, vi } from "vitest";
import {
  type ApplicationSort,
  SortColumn,
  SortDirection,
  compareApplications,
  parseApplicationSort,
} from "@/lib/applications/sort";
import { buildSummary } from "@/lib/applications/test-fixtures";
import type { ApplicationSummary } from "@/lib/applications/queries";

// test-fixtures reaches the server-only repository module.
vi.mock("server-only", () => ({}));

const UNKNOWN_COLUMN = "status";
const WRONG_CASE_COLUMN = "Business";
const UNKNOWN_DIRECTION = "up";

const FIRST_ID = "APP-2026-9001";
const SECOND_ID = "APP-2026-9002";
const THIRD_ID = "APP-2026-9003";

function sortIds(summaries: ApplicationSummary[], sort: ApplicationSort): string[] {
  return [...summaries].sort(compareApplications(sort)).map((s) => s.applicationId);
}

describe("parseApplicationSort", () => {
  it("falls back to the default for invalid sort and dir values", () => {
    const cases: [Parameters<typeof parseApplicationSort>[0], ApplicationSort][] = [
      [
        { sort: UNKNOWN_COLUMN, dir: SortDirection.Desc },
        { column: SortColumn.Application, direction: SortDirection.Desc },
      ],
      [
        { sort: WRONG_CASE_COLUMN, dir: SortDirection.Asc },
        { column: SortColumn.Application, direction: SortDirection.Asc },
      ],
      [
        { sort: SortColumn.Business, dir: UNKNOWN_DIRECTION },
        { column: SortColumn.Business, direction: SortDirection.Asc },
      ],
      [
        { sort: [SortColumn.Business, SortColumn.Applied] },
        { column: SortColumn.Application, direction: SortDirection.Asc },
      ],
    ];

    const parsed = cases.map(([params]) => parseApplicationSort(params));

    expect(parsed).toEqual(cases.map(([, expected]) => expected));
  });

  it("parses a valid sort and dir", () => {
    const parsed = parseApplicationSort({ sort: SortColumn.Applied, dir: SortDirection.Desc });

    expect(parsed).toEqual({ column: SortColumn.Applied, direction: SortDirection.Desc });
  });
});

describe("compareApplications", () => {
  it("compares business names ignoring case", () => {
    // Plain code-point order would put "Apex Co" first, since "A" < "a".
    const summaries = [
      buildSummary({ applicationId: FIRST_ID, businessName: "Apex Co" }),
      buildSummary({ applicationId: SECOND_ID, businessName: "acme Inc" }),
    ];

    const ids = sortIds(summaries, { column: SortColumn.Business, direction: SortDirection.Asc });

    expect(ids).toEqual([SECOND_ID, FIRST_ID]);
  });

  // Stored-text order would be 1/5/2026, 12/1/2025, 9/11/2025.
  const datedSummaries = [
    buildSummary({ applicationId: FIRST_ID, applicationDate: "1/5/2026" }),
    buildSummary({ applicationId: SECOND_ID, applicationDate: "12/1/2025" }),
    buildSummary({ applicationId: THIRD_ID, applicationDate: "9/11/2025" }),
  ];

  it("orders application dates chronologically when ascending", () => {
    const ids = sortIds(datedSummaries, { column: SortColumn.Applied, direction: SortDirection.Asc });

    expect(ids).toEqual([THIRD_ID, SECOND_ID, FIRST_ID]);
  });

  it("orders application dates reverse-chronologically when descending", () => {
    const ids = sortIds(datedSummaries, { column: SortColumn.Applied, direction: SortDirection.Desc });

    expect(ids).toEqual([FIRST_ID, SECOND_ID, THIRD_ID]);
  });

  it.each([
    [SortColumn.Business, SortDirection.Asc],
    [SortColumn.Business, SortDirection.Desc],
    [SortColumn.Applied, SortDirection.Asc],
    [SortColumn.Applied, SortDirection.Desc],
  ])("breaks a %s tie by application ID ascending when %s", (column, direction) => {
    // Identical sort keys; IDs supplied out of order so a stable sort can't pass by accident.
    const summaries = [buildSummary({ applicationId: SECOND_ID }), buildSummary({ applicationId: FIRST_ID })];

    const ids = sortIds(summaries, { column, direction });

    expect(ids).toEqual([FIRST_ID, SECOND_ID]);
  });
});
