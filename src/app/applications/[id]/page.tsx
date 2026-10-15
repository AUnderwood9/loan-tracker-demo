import { notFound } from "next/navigation";
import ApplicationHeader from "@/components/ApplicationHeader";
import BackToApplicationsLink from "@/components/BackToApplicationsLink";
import ChecklistTable from "@/components/ChecklistTable";
import { getApplication } from "@/lib/applications/queries";
import { UI_TEXT } from "@/lib/ui/ui-text";

export default async function ApplicationDetailPage({ params }: PageProps<"/applications/[id]">) {
  const { id } = await params;
  const application = await getApplication(id);
  if (application === null) {
    notFound();
  }

  return (
    <section>
      <BackToApplicationsLink />
      <ApplicationHeader application={application} />
      <h2>{UI_TEXT.checklistHeading}</h2>
      <ChecklistTable items={application.items} />
    </section>
  );
}
