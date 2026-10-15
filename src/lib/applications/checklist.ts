import {
  DOCUMENT_TYPES,
  NOT_ON_CHECKLIST_LABEL,
  NOT_STARTED_LABEL,
  SATISFIED_STATUSES,
  type DocumentType,
} from "@/lib/applications/constants";
import type { DocumentRow } from "@/lib/applications/csv-repository";

export interface ChecklistItem {
  documentType: DocumentType;
  /** Display status: the stored value, or the Not Started / Not on checklist label. */
  status: string;
  row: DocumentRow | null;
  isSatisfied: boolean;
}

export interface Checklist {
  items: ChecklistItem[];
  documentCount: number;
  outstandingCount: number;
  isComplete: boolean;
}

function displayStatus(row: DocumentRow | null): string {
  if (row === null) {
    return NOT_ON_CHECKLIST_LABEL;
  }
  return row.documentStatus.trim() === "" ? NOT_STARTED_LABEL : row.documentStatus;
}

/** Derives one application's 12-item checklist; `rows` must belong to a single application. */
export function buildChecklist(rows: readonly DocumentRow[]): Checklist {
  const items = DOCUMENT_TYPES.map((documentType): ChecklistItem => {
    const row = rows.find((r) => r.documentType === documentType) ?? null;
    const status = displayStatus(row);
    return { documentType, status, row, isSatisfied: SATISFIED_STATUSES.has(status) };
  });

  const documentCount = items.filter((item) => item.row !== null).length;
  const outstandingCount = items.filter((item) => !item.isSatisfied).length;

  return { items, documentCount, outstandingCount, isComplete: outstandingCount === 0 };
}
