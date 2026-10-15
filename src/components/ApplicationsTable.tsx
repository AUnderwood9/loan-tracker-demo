import type { ReactNode } from "react";
import Link from "next/link";
import ApplicationStatusBadge from "@/components/ApplicationStatusBadge";
import SortableColumnHeader from "@/components/SortableColumnHeader";
import type { ApplicationSummary } from "@/lib/applications/queries";
import type { ApplicationSort } from "@/lib/applications/sort";
import { APPLICATION_COLUMN_LABELS, ApplicationColumn, SORTABLE_COLUMNS } from "@/lib/ui/columns";
import {
  ELEMENT_IDS,
  applicationCellId,
  applicationHeaderId,
  applicationLinkId,
  applicationRowId,
} from "@/lib/ui/element-ids";
import { formatLoanAmount } from "@/lib/ui/format";
import { ROUTES } from "@/lib/ui/routes";
import { documentCountLabel } from "@/lib/ui/ui-text";

interface ApplicationsTableProps {
  applications: readonly ApplicationSummary[];
  sort: ApplicationSort;
}

const COLUMNS = Object.values(ApplicationColumn);

function renderCells(application: ApplicationSummary): Record<ApplicationColumn, ReactNode> {
  return {
    [ApplicationColumn.ApplicationId]: (
      <Link
        id={applicationLinkId(application.applicationId)}
        href={ROUTES.application(application.applicationId)}
        className="row-link"
      >
        {application.applicationId}
      </Link>
    ),
    [ApplicationColumn.BusinessName]: application.businessName,
    [ApplicationColumn.BorrowerName]: application.borrowerName,
    [ApplicationColumn.LoanAmount]: formatLoanAmount(application.loanAmount),
    [ApplicationColumn.AssignedProcessor]: application.assignedProcessor,
    [ApplicationColumn.ApplicationDate]: application.applicationDate,
    [ApplicationColumn.Documents]: documentCountLabel(application.documentCount),
    [ApplicationColumn.Status]: (
      <ApplicationStatusBadge
        isComplete={application.isComplete}
        outstandingCount={application.outstandingCount}
      />
    ),
  };
}

export default function ApplicationsTable({ applications, sort }: ApplicationsTableProps) {
  return (
    <table id={ELEMENT_IDS.applicationsTable} className="data-table applications-table">
      <thead>
        <tr>
          {COLUMNS.map((column) => {
            const sortColumn = SORTABLE_COLUMNS[column];
            return sortColumn ? (
              <SortableColumnHeader key={column} column={column} sortColumn={sortColumn} sort={sort} />
            ) : (
              <th key={column} id={applicationHeaderId(column)} scope="col">
                {APPLICATION_COLUMN_LABELS[column]}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {applications.map((application) => {
          const cells = renderCells(application);
          return (
            <tr key={application.applicationId} id={applicationRowId(application.applicationId)}>
              {COLUMNS.map((column) => (
                <td key={column} id={applicationCellId(application.applicationId, column)}>
                  {cells[column]}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
