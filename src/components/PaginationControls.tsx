import PaginationArrow from "@/components/PaginationArrow";
import type { Page } from "@/lib/applications/pagination";
import type { ApplicationSort } from "@/lib/applications/sort";
import { ELEMENT_IDS } from "@/lib/ui/element-ids";
import { ROUTES } from "@/lib/ui/routes";
import { UI_TEXT, pageStatusLabel } from "@/lib/ui/ui-text";

interface PaginationControlsProps
  extends Pick<Page<unknown>, "page" | "totalPages" | "hasPrevious" | "hasNext"> {
  sort: ApplicationSort;
}

export default function PaginationControls({
  page,
  totalPages,
  hasPrevious,
  hasNext,
  sort,
}: PaginationControlsProps) {
  return (
    <nav id={ELEMENT_IDS.paginationControls} className="pagination-controls">
      <PaginationArrow
        id={ELEMENT_IDS.paginationPrevious}
        href={hasPrevious ? ROUTES.pagedApplications(sort, page - 1) : undefined}
      >
        <span aria-hidden="true">{UI_TEXT.previousPageArrow}</span> {UI_TEXT.previousPage}
      </PaginationArrow>
      <span id={ELEMENT_IDS.paginationStatus} className="pagination-status">
        {pageStatusLabel(page, totalPages)}
      </span>
      <PaginationArrow
        id={ELEMENT_IDS.paginationNext}
        href={hasNext ? ROUTES.pagedApplications(sort, page + 1) : undefined}
      >
        {UI_TEXT.nextPage} <span aria-hidden="true">{UI_TEXT.nextPageArrow}</span>
      </PaginationArrow>
    </nav>
  );
}
