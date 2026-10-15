import Link from "next/link";
import LinkPendingLoader from "@/components/LinkPendingLoader";
import { SortDirection, type ApplicationSort, type SortColumn } from "@/lib/applications/sort";
import { APPLICATION_COLUMN_LABELS, type ApplicationColumn } from "@/lib/ui/columns";
import {
  SortArrowState,
  applicationHeaderId,
  sortArrowId,
  sortIndicatorId,
  sortLinkId,
} from "@/lib/ui/element-ids";
import { ROUTES } from "@/lib/ui/routes";
import { SORT_INDICATORS } from "@/lib/ui/ui-text";

interface SortableColumnHeaderProps {
  column: ApplicationColumn;
  sortColumn: SortColumn;
  sort: ApplicationSort;
}

const ARIA_SORT: Record<SortDirection, "ascending" | "descending"> = {
  [SortDirection.Asc]: "ascending",
  [SortDirection.Desc]: "descending",
};
const ARIA_SORT_NONE = "none";

function nextSort(sortColumn: SortColumn, sort: ApplicationSort): ApplicationSort {
  if (sortColumn !== sort.column) {
    return { column: sortColumn, direction: SortDirection.Asc };
  }
  const direction = sort.direction === SortDirection.Asc ? SortDirection.Desc : SortDirection.Asc;
  return { column: sortColumn, direction };
}

export default function SortableColumnHeader({ column, sortColumn, sort }: SortableColumnHeaderProps) {
  const isActive = sortColumn === sort.column;

  return (
    <th
      id={applicationHeaderId(column)}
      scope="col"
      className="sortable-header"
      aria-sort={isActive ? ARIA_SORT[sort.direction] : ARIA_SORT_NONE}
    >
      <Link
        id={sortLinkId(sortColumn)}
        href={ROUTES.sortedApplications(nextSort(sortColumn, sort))}
        className="sort-link"
      >
        {APPLICATION_COLUMN_LABELS[column]}
        <span id={sortIndicatorId(sortColumn)} className="sort-indicator" aria-hidden="true">
          {Object.values(SortDirection).map((direction) => (
            <span
              key={direction}
              id={sortArrowId(sortColumn, direction)}
              className="sort-arrow"
              data-state={
                isActive && direction === sort.direction ? SortArrowState.Active : SortArrowState.Inactive
              }
            >
              {SORT_INDICATORS[direction]}
            </span>
          ))}
        </span>
        <LinkPendingLoader />
      </Link>
    </th>
  );
}
