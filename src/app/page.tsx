import ApplicationsTable from "@/components/ApplicationsTable";
import PaginationControls from "@/components/PaginationControls";
import { paginate, parsePageParam } from "@/lib/applications/pagination";
import { listApplications } from "@/lib/applications/queries";
import { parseApplicationSort } from "@/lib/applications/sort";
import { ELEMENT_IDS } from "@/lib/ui/element-ids";
import { UI_TEXT, applicationCountLabel } from "@/lib/ui/ui-text";

export default async function ApplicationsPage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const sort = parseApplicationSort(params);
  const { items, totalCount, ...pagination } = paginate(
    await listApplications(sort),
    parsePageParam(params.page),
  );

  return (
    <section>
      <h1>{UI_TEXT.applicationsHeading}</h1>
      {totalCount === 0 ? (
        <p id={ELEMENT_IDS.applicationsEmpty} className="page-message">
          {UI_TEXT.emptyApplications}
        </p>
      ) : (
        <>
          <p id={ELEMENT_IDS.applicationCount} className="summary-line">
            {applicationCountLabel(totalCount)}
          </p>
          <ApplicationsTable applications={items} sort={sort} />
          <PaginationControls {...pagination} sort={sort} />
        </>
      )}
    </section>
  );
}
