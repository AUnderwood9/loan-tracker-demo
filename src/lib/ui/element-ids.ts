import type { SortColumn, SortDirection } from "@/lib/applications/sort";
import type { ApplicationColumn, ApplicationField, ChecklistColumn } from "@/lib/ui/columns";

export const ELEMENT_IDS = {
  appHeader: "app-header",
  homeLink: "home-link",
  mainContent: "main-content",
  pageLoader: "page-loader",
  pageError: "page-error",
  pageErrorRetry: "page-error-retry",
  applicationCount: "application-count",
  applicationsTable: "applications-table",
  applicationsEmpty: "applications-empty",
  applicationTitle: "application-title",
  checklistTable: "checklist-table",
  applicationNotFound: "application-not-found",
  backToApplications: "back-to-applications",
  paginationControls: "pagination-controls",
  paginationPrevious: "pagination-previous",
  paginationNext: "pagination-next",
  paginationStatus: "pagination-status",
} as const;

/** Lower-cases and joins `parts`, turning every run of non-alphanumerics into one hyphen. */
export function toElementId(...parts: string[]): string {
  return parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function applicationRowId(applicationId: string): string {
  return toElementId("application-row", applicationId);
}

export function applicationLinkId(applicationId: string): string {
  return toElementId("application-link", applicationId);
}

export function applicationCellId(applicationId: string, column: ApplicationColumn): string {
  return toElementId("application", applicationId, column);
}

export function applicationHeaderId(column: ApplicationColumn): string {
  return toElementId("applications-header", column);
}

export function sortLinkId(column: SortColumn): string {
  return toElementId("sort-link", column);
}

export function sortIndicatorId(column: SortColumn): string {
  return toElementId("sort-indicator", column);
}

export function sortArrowId(column: SortColumn, direction: SortDirection): string {
  return toElementId("sort-arrow", column, direction);
}

/** The `data-state` of a sort arrow: active is the sorted column's current direction. */
export enum SortArrowState {
  Active = "active",
  Inactive = "inactive",
}

export function applicationFieldId(field: ApplicationField): string {
  return toElementId("application", field);
}

export function checklistRowId(documentType: string): string {
  return toElementId("checklist-row", documentType);
}

export function checklistCellId(documentType: string, column: ChecklistColumn): string {
  return toElementId("checklist", documentType, column);
}
