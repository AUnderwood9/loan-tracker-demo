// Relative, not "@/": Cypress specs import this module and their bundler has no alias.
import { DOCUMENT_TYPES } from "../applications/constants";
import { SortDirection } from "../applications/sort";

export const UI_TEXT = {
  appTitle: "Loan Document Tracker",
  applicationsHeading: "Applications",
  emptyApplications: "No open applications to display",
  errorMessage: "An error has occurred",
  errorRetry: "Try again",
  loadingApplications: "Loading applications…",
  loadingApplication: "Loading application…",
  applicationNotFound: "Application not found",
  backToApplications: "Back to applications",
  checklistHeading: "Document checklist",
  complete: "Complete",
  previousPage: "Previous",
  nextPage: "Next",
  previousPageArrow: "‹",
  nextPageArrow: "›",
} as const;

export const SORT_INDICATORS: Record<SortDirection, string> = {
  [SortDirection.Asc]: "▲",
  [SortDirection.Desc]: "▼",
};

export function applicationCountLabel(count: number): string {
  return `${count} ${count === 1 ? "application" : "applications"}`;
}

export function pageStatusLabel(page: number, totalPages: number): string {
  return `Page ${page} of ${totalPages}`;
}

export function documentCountLabel(count: number): string {
  return `${count} of ${DOCUMENT_TYPES.length}`;
}

export function outstandingLabel(count: number): string {
  return `${count} outstanding`;
}
