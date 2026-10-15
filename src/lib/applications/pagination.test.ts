import { afterEach, describe, expect, it, vi } from "vitest";
import { PAGE_SIZE, type Page, paginate, parsePageParam } from "@/lib/applications/pagination";
import { type ApplicationSummary, listApplications } from "@/lib/applications/queries";
import { SortColumn, SortDirection } from "@/lib/applications/sort";
import {
  SAMPLE_LAST_APPLICATION_ID,
  buildSummary,
  cleanUpCsvFixtures,
  useSampleCsvFixture,
} from "@/lib/applications/test-fixtures";

// test-fixtures and queries reach the server-only repository module; pagination itself does not.
vi.mock("server-only", () => ({}));

const FIRST_PAGE = 1;
const SAMPLE_PAGE_COUNT = 6;
const PAST_THE_END_PAGE = "99";
const PARTIAL_FIXTURE_COUNT = 23;
const PARTIAL_FIXTURE_PAGE_COUNT = 3;
const PARTIAL_FIXTURE_LAST_PAGE_SIZE = 3;
const BUILDER_ID_BASE = 9001;

function buildSummaries(count: number): ApplicationSummary[] {
  return Array.from({ length: count }, (_, index) =>
    buildSummary({ applicationId: `APP-2026-${BUILDER_ID_BASE + index}` }),
  );
}

function ids(page: Page<ApplicationSummary>): string[] {
  return page.items.map((summary) => summary.applicationId);
}

function firstAndLastIds(page: Page<ApplicationSummary>): [string | undefined, string | undefined] {
  return [page.items.at(0)?.applicationId, page.items.at(-1)?.applicationId];
}

function allPages<T>(items: readonly T[]): Page<T>[] {
  const { totalPages } = paginate(items, FIRST_PAGE);
  return Array.from({ length: totalPages }, (_, index) => paginate(items, FIRST_PAGE + index));
}

function flags(page: Page<unknown>): { hasPrevious: boolean; hasNext: boolean } {
  return { hasPrevious: page.hasPrevious, hasNext: page.hasNext };
}

afterEach(cleanUpCsvFixtures);

describe("pagination acceptance", () => {
  it("paginates to the end of the list", async () => {
    await useSampleCsvFixture();
    const summaries = await listApplications();
    const partial = buildSummaries(PARTIAL_FIXTURE_COUNT);

    const samplePages = allPages(summaries);
    const partialPages = allPages(partial);

    expect(samplePages).toHaveLength(SAMPLE_PAGE_COUNT);
    expect(samplePages.every((page) => page.items.length === PAGE_SIZE)).toBe(true);
    expect(samplePages.at(-1)?.items.at(-1)?.applicationId).toBe(SAMPLE_LAST_APPLICATION_ID);
    expect(samplePages.flatMap(ids)).toEqual(summaries.map((summary) => summary.applicationId));
    expect(partialPages).toHaveLength(PARTIAL_FIXTURE_PAGE_COUNT);
    expect(partialPages.at(-1)?.items).toEqual(partial.slice(-PARTIAL_FIXTURE_LAST_PAGE_SIZE));
  });

  it("can't paginate before page 1", async () => {
    await useSampleCsvFixture();
    const summaries = await listApplications();

    const firstPage = paginate(summaries, FIRST_PAGE);
    const parsed = [parsePageParam("0"), parsePageParam("-1")];

    expect(firstPage.hasPrevious).toBe(false);
    expect(parsed).toEqual([FIRST_PAGE, FIRST_PAGE]);
  });

  it("disables the arrows at either end of the list", async () => {
    await useSampleCsvFixture();
    const summaries = await listApplications();

    const firstPage = paginate(summaries, FIRST_PAGE);
    const lastPage = paginate(summaries, SAMPLE_PAGE_COUNT);
    const singlePage = paginate(buildSummaries(PAGE_SIZE), FIRST_PAGE);

    expect(flags(firstPage)).toEqual({ hasPrevious: false, hasNext: true });
    expect(flags(lastPage)).toEqual({ hasPrevious: true, hasNext: false });
    expect(flags(singlePage)).toEqual({ hasPrevious: false, hasNext: false });
  });

  it("accepts valid page values", async () => {
    await useSampleCsvFixture();
    const summaries = await listApplications();
    const byBusiness = await listApplications({ column: SortColumn.Business, direction: SortDirection.Asc });

    const secondPage = paginate(summaries, parsePageParam("2"));
    const pastTheEnd = paginate(summaries, parsePageParam(PAST_THE_END_PAGE));
    const byAppliedDesc = await listApplications({ column: SortColumn.Applied, direction: SortDirection.Desc });
    const businessSecondPage = paginate(byBusiness, parsePageParam("2"));
    const appliedDescLastPage = paginate(byAppliedDesc, parsePageParam("6"));

    expect(secondPage.page).toBe(2);
    expect(firstAndLastIds(secondPage)).toEqual(["APP-2026-1011", "APP-2026-1020"]);
    expect(pastTheEnd.page).toBe(SAMPLE_PAGE_COUNT);
    expect(firstAndLastIds(pastTheEnd)).toEqual(["APP-2026-1051", SAMPLE_LAST_APPLICATION_ID]);
    expect(firstAndLastIds(businessSecondPage)).toEqual(["APP-2026-1032", "APP-2026-1036"]);
    expect(firstAndLastIds(appliedDescLastPage)).toEqual(["APP-2026-1053", "APP-2026-1056"]);
  });

  it("falls back to page 1 for empty page values", () => {
    const parsed = [parsePageParam(undefined), parsePageParam("")];

    expect(parsed).toEqual([FIRST_PAGE, FIRST_PAGE]);
  });

  it("falls back to page 1 for invalid page values", () => {
    const invalid: (string | string[])[] = ["abc", "2.5", "02", " 2", ["2", "3"]];

    const parsed = invalid.map((value) => parsePageParam(value));

    expect(parsed).toEqual(invalid.map(() => FIRST_PAGE));
  });
});

describe("parsePageParam", () => {
  it("returns a valid page number unchanged, including one past the end", () => {
    const parsed = [parsePageParam("6"), parsePageParam("15"), parsePageParam(PAST_THE_END_PAGE)];

    expect(parsed).toEqual([6, 15, Number(PAST_THE_END_PAGE)]);
  });
});

describe("paginate", () => {
  it("returns page 1 of 1 for an empty list", () => {
    const page = paginate([], FIRST_PAGE);

    expect(page).toEqual({
      items: [],
      page: FIRST_PAGE,
      totalPages: 1,
      totalCount: 0,
      hasPrevious: false,
      hasNext: false,
    });
  });

  it("fits exactly one page size of items on a single page", () => {
    const page = paginate(buildSummaries(PAGE_SIZE), FIRST_PAGE);

    expect(page.totalPages).toBe(1);
  });

  it("puts the item after a full page on a second page", () => {
    const summaries = buildSummaries(PAGE_SIZE + 1);

    const secondPage = paginate(summaries, 2);

    expect(secondPage.totalPages).toBe(2);
    expect(secondPage.items).toEqual(summaries.slice(PAGE_SIZE));
  });

  it("does not mutate the input list", () => {
    const summaries = buildSummaries(PARTIAL_FIXTURE_COUNT);
    const snapshot = [...summaries];

    paginate(Object.freeze(summaries), PARTIAL_FIXTURE_PAGE_COUNT);

    expect(summaries).toEqual(snapshot);
  });

  it("reports the total count of all items whatever the page", () => {
    const summaries = buildSummaries(PARTIAL_FIXTURE_COUNT);

    const totals = allPages(summaries).map((page) => page.totalCount);

    expect(totals).toEqual(Array(PARTIAL_FIXTURE_PAGE_COUNT).fill(PARTIAL_FIXTURE_COUNT));
  });
});
