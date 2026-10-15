// Relative, not "@/": Cypress specs import this module and their bundler has no alias.
import type { ApplicationSort } from "../applications/sort";

const APPLICATIONS_PATH = "/";
const SORT_QUERY_PARAM = "sort";
const DIRECTION_QUERY_PARAM = "dir";
const PAGE_QUERY_PARAM = "page";

function sortQuery({ column, direction }: ApplicationSort): Record<string, string> {
  return { [SORT_QUERY_PARAM]: column, [DIRECTION_QUERY_PARAM]: direction };
}

export const ROUTES = {
  applications: APPLICATIONS_PATH,
  // No page param: a new sort always starts on page 1 (Q31).
  sortedApplications: (sort: ApplicationSort): string =>
    `${APPLICATIONS_PATH}?${new URLSearchParams(sortQuery(sort))}`,
  pagedApplications: (sort: ApplicationSort, page: number): string =>
    `${APPLICATIONS_PATH}?${new URLSearchParams({ ...sortQuery(sort), [PAGE_QUERY_PARAM]: String(page) })}`,
  application: (applicationId: string): string => `/applications/${applicationId}`,
} as const;
