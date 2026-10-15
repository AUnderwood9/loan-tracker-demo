/** `DocumentRow` field → CSV header, in file column order. */
export const CSV_COLUMN_BY_FIELD = {
  applicationId: "application_id",
  businessName: "business_name",
  borrowerName: "borrower_name",
  loanAmount: "loan_amount",
  applicationDate: "application_date",
  assignedProcessor: "assigned_processor",
  documentType: "document_type",
  documentStatus: "document_status",
  dateReceived: "date_received",
  expirationDate: "expiration_date",
  notes: "notes",
} as const;

export type DocumentRowField = keyof typeof CSV_COLUMN_BY_FIELD;

export const DOCUMENT_ROW_FIELDS = Object.keys(CSV_COLUMN_BY_FIELD) as readonly DocumentRowField[];
export const CSV_COLUMNS: readonly string[] = Object.values(CSV_COLUMN_BY_FIELD);

// Declared in alphabetical order: the checklist renders in this order.
export enum DocumentType {
  ArticlesOfIncorporation = "Articles of Incorporation",
  BankStatements90Day = "Bank Statements (90 day)",
  BusinessFinancialStatements = "Business Financial Statements",
  BusinessLicensesAndPermits = "Business Licenses & Permits",
  BusinessTaxReturns3Yr = "Business Tax Returns (3yr)",
  DebtSchedule = "Debt Schedule",
  InsuranceVerification = "Insurance Verification",
  LeaseAgreement = "Lease Agreement",
  OwnershipVerification = "Ownership Verification",
  PersonalTaxReturns3Yr = "Personal Tax Returns (3yr)",
  SbaForm1919 = "SBA Form 1919",
  SbaForm912 = "SBA Form 912",
}

export const DOCUMENT_TYPES: readonly DocumentType[] = Object.values(DocumentType);

export enum DocumentStatus {
  Pending = "Pending",
  Received = "Received",
  UnderReview = "Under Review",
  Approved = "Approved",
  Expired = "Expired",
  NotRequired = "Not Required",
}

export const SATISFIED_STATUSES: ReadonlySet<string> = new Set([
  DocumentStatus.Approved,
  DocumentStatus.NotRequired,
]);

// Display-only labels: never written to the CSV and never satisfied.
export const NOT_STARTED_LABEL = "Not Started";
export const NOT_ON_CHECKLIST_LABEL = "Not on checklist";
