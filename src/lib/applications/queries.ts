import "server-only";
import { buildChecklist, type Checklist, type ChecklistItem } from "@/lib/applications/checklist";
import { readRows, type DocumentRow } from "@/lib/applications/csv-repository";
import {
  DEFAULT_APPLICATION_SORT,
  compareApplications,
  type ApplicationSort,
} from "@/lib/applications/sort";

export interface ApplicationSummary {
  applicationId: string;
  businessName: string;
  borrowerName: string;
  loanAmount: number;
  /** As stored, `M/D/YYYY`. */
  applicationDate: string;
  assignedProcessor: string;
  documentCount: number;
  outstandingCount: number;
  isComplete: boolean;
}

export interface ApplicationDetail extends ApplicationSummary {
  items: ChecklistItem[];
}

function groupByApplication(rows: readonly DocumentRow[]): Map<string, DocumentRow[]> {
  const groups = new Map<string, DocumentRow[]>();
  for (const row of rows) {
    const group = groups.get(row.applicationId);
    if (group) {
      group.push(row);
    } else {
      groups.set(row.applicationId, [row]);
    }
  }
  return groups;
}

function toSummary([first]: readonly DocumentRow[], checklist: Checklist): ApplicationSummary {
  return {
    applicationId: first.applicationId,
    businessName: first.businessName,
    borrowerName: first.borrowerName,
    loanAmount: Number(first.loanAmount),
    applicationDate: first.applicationDate,
    assignedProcessor: first.assignedProcessor,
    documentCount: checklist.documentCount,
    outstandingCount: checklist.outstandingCount,
    isComplete: checklist.isComplete,
  };
}

export async function listApplications(
  sort: ApplicationSort = DEFAULT_APPLICATION_SORT,
): Promise<ApplicationSummary[]> {
  const groups = groupByApplication(await readRows());
  return [...groups.values()]
    .map((rows) => toSummary(rows, buildChecklist(rows)))
    .sort(compareApplications(sort));
}

export async function getApplication(applicationId: string): Promise<ApplicationDetail | null> {
  const rows = (await readRows()).filter((row) => row.applicationId === applicationId);
  if (rows.length === 0) {
    return null;
  }
  const checklist = buildChecklist(rows);
  return { ...toSummary(rows, checklist), items: checklist.items };
}
