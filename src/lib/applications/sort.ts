// Not server-only: the list page's client-side header links import these enums.
import type { ApplicationSummary } from "@/lib/applications/queries";

/** Values are the `sort` URL param. */
export enum SortColumn {
  Application = "application",
  Business = "business",
  Applied = "applied",
}

/** Values are the `dir` URL param. */
export enum SortDirection {
  Asc = "asc",
  Desc = "desc",
}

export interface ApplicationSort {
  column: SortColumn;
  direction: SortDirection;
}

export interface ApplicationSortParams {
  sort?: string | string[];
  dir?: string | string[];
}

export const DEFAULT_APPLICATION_SORT: Readonly<ApplicationSort> = Object.freeze({
  column: SortColumn.Application,
  direction: SortDirection.Asc,
});

type ApplicationComparator = (a: ApplicationSummary, b: ApplicationSummary) => number;

const SORT_COLUMNS: readonly string[] = Object.values(SortColumn);
const SORT_DIRECTIONS: readonly string[] = Object.values(SortDirection);
const BUSINESS_NAME_COLLATOR = new Intl.Collator("en-US", { sensitivity: "base" });
const APPLICATION_DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function pickParam<T extends string>(value: string | string[] | undefined, allowed: readonly string[], fallback: T): T {
  // A repeated param arrives as an array and is treated as invalid.
  return typeof value === "string" && allowed.includes(value) ? (value as T) : fallback;
}

export function parseApplicationSort(params: ApplicationSortParams): ApplicationSort {
  return {
    column: pickParam(params.sort, SORT_COLUMNS, DEFAULT_APPLICATION_SORT.column),
    direction: pickParam(params.dir, SORT_DIRECTIONS, DEFAULT_APPLICATION_SORT.direction),
  };
}

function compareValues(a: string | number, b: string | number): number {
  if (a < b) {
    return -1;
  }
  return a > b ? 1 : 0;
}

/** `M/D/YYYY` → a sortable `YYYYMMDD` number. Unparseable dates sort after every valid one. */
function applicationDateKey(value: string): number {
  const match = APPLICATION_DATE_PATTERN.exec(value.trim());
  if (!match) {
    return Number.POSITIVE_INFINITY;
  }
  const [, month, day, year] = match.map(Number);
  return year * 10_000 + month * 100 + day;
}

const PRIMARY_COMPARATORS: Record<SortColumn, ApplicationComparator> = {
  [SortColumn.Application]: (a, b) => compareValues(a.applicationId, b.applicationId),
  [SortColumn.Business]: (a, b) => BUSINESS_NAME_COLLATOR.compare(a.businessName, b.businessName),
  [SortColumn.Applied]: (a, b) =>
    compareValues(applicationDateKey(a.applicationDate), applicationDateKey(b.applicationDate)),
};

export function compareApplications(sort: ApplicationSort): ApplicationComparator {
  const primary = PRIMARY_COMPARATORS[sort.column];
  const sign = sort.direction === SortDirection.Desc ? -1 : 1;
  // Ties fall back to ID ascending regardless of direction (Q26).
  return (a, b) => sign * primary(a, b) || compareValues(a.applicationId, b.applicationId);
}
