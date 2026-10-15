import type { ReactNode } from "react";
import ApplicationStatusBadge from "@/components/ApplicationStatusBadge";
import type { ApplicationSummary } from "@/lib/applications/queries";
import { APPLICATION_FIELD_LABELS, ApplicationField } from "@/lib/ui/columns";
import { ELEMENT_IDS, applicationFieldId } from "@/lib/ui/element-ids";
import { formatLoanAmount } from "@/lib/ui/format";

interface ApplicationHeaderProps {
  application: ApplicationSummary;
}

export default function ApplicationHeader({ application }: ApplicationHeaderProps) {
  const fields: Record<ApplicationField, ReactNode> = {
    [ApplicationField.BorrowerName]: application.borrowerName,
    [ApplicationField.LoanAmount]: formatLoanAmount(application.loanAmount),
    [ApplicationField.AssignedProcessor]: application.assignedProcessor,
    [ApplicationField.ApplicationDate]: application.applicationDate,
    [ApplicationField.Status]: (
      <ApplicationStatusBadge
        isComplete={application.isComplete}
        outstandingCount={application.outstandingCount}
      />
    ),
  };

  return (
    <header>
      <h1 id={ELEMENT_IDS.applicationTitle}>
        {application.businessName} ({application.applicationId})
      </h1>
      <dl className="application-fields">
        {Object.values(ApplicationField).map((field) => (
          <div key={field} className="application-field">
            <dt>{APPLICATION_FIELD_LABELS[field]}</dt>
            <dd id={applicationFieldId(field)}>{fields[field]}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}
