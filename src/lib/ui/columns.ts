// Relative, not "@/": Cypress specs import this module and their bundler has no alias.
import { SortColumn } from "../applications/sort";

// Declared in display order.
export enum ApplicationColumn {
  ApplicationId = "application-id",
  BusinessName = "business-name",
  BorrowerName = "borrower-name",
  LoanAmount = "loan-amount",
  AssignedProcessor = "assigned-processor",
  ApplicationDate = "application-date",
  Documents = "documents",
  Status = "status",
}

export const APPLICATION_COLUMN_LABELS: Record<ApplicationColumn, string> = {
  [ApplicationColumn.ApplicationId]: "Application",
  [ApplicationColumn.BusinessName]: "Business",
  [ApplicationColumn.BorrowerName]: "Borrower",
  [ApplicationColumn.LoanAmount]: "Loan amount",
  [ApplicationColumn.AssignedProcessor]: "Processor",
  [ApplicationColumn.ApplicationDate]: "Applied",
  [ApplicationColumn.Documents]: "Documents",
  [ApplicationColumn.Status]: "Status",
};

export const SORTABLE_COLUMNS: Partial<Record<ApplicationColumn, SortColumn>> = {
  [ApplicationColumn.ApplicationId]: SortColumn.Application,
  [ApplicationColumn.BusinessName]: SortColumn.Business,
  [ApplicationColumn.ApplicationDate]: SortColumn.Applied,
};

// Declared in display order.
export enum ChecklistColumn {
  DocumentType = "document-type",
  Status = "status",
  DateReceived = "date-received",
  ExpirationDate = "expiration-date",
  Notes = "notes",
}

export const CHECKLIST_COLUMN_LABELS: Record<ChecklistColumn, string> = {
  [ChecklistColumn.DocumentType]: "Document",
  [ChecklistColumn.Status]: "Status",
  [ChecklistColumn.DateReceived]: "Received",
  [ChecklistColumn.ExpirationDate]: "Expires",
  [ChecklistColumn.Notes]: "Notes",
};

export enum ApplicationField {
  BorrowerName = "borrower-name",
  LoanAmount = "loan-amount",
  AssignedProcessor = "assigned-processor",
  ApplicationDate = "application-date",
  Status = "status",
}

export const APPLICATION_FIELD_LABELS: Record<ApplicationField, string> = {
  [ApplicationField.BorrowerName]: "Borrower",
  [ApplicationField.LoanAmount]: "Loan amount",
  [ApplicationField.AssignedProcessor]: "Processor",
  [ApplicationField.ApplicationDate]: "Applied",
  [ApplicationField.Status]: "Status",
};
