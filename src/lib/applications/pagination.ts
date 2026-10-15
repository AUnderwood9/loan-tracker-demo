// Not server-only: the list page's pagination controls import these types.

export const PAGE_SIZE = 10;

const FIRST_PAGE = 1;
// Digits only, no leading zero, so "0", "02", "2.5", " 2" and "-1" are all rejected.
const PAGE_PARAM_PATTERN = /^[1-9]\d*$/;

export interface Page<T> {
  items: T[];
  page: number;
  totalPages: number;
  totalCount: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

/** Any invalid, empty, missing or repeated `page` param → page 1 (Q28). */
export function parsePageParam(page?: string | string[]): number {
  return typeof page === "string" && PAGE_PARAM_PATTERN.test(page) ? Number(page) : FIRST_PAGE;
}

/** Slices an already-sorted list; a page past the end clamps to the last page (Q29). */
export function paginate<T>(items: readonly T[], requestedPage: number): Page<T> {
  const totalCount = items.length;
  const totalPages = Math.max(FIRST_PAGE, Math.ceil(totalCount / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const start = (page - 1) * PAGE_SIZE;
  return {
    items: items.slice(start, start + PAGE_SIZE),
    page,
    totalPages,
    totalCount,
    hasPrevious: page > FIRST_PAGE,
    hasNext: page < totalPages,
  };
}
