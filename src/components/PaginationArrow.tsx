import type { ReactNode } from "react";
import Link from "next/link";
import LinkPendingLoader from "@/components/LinkPendingLoader";

interface PaginationArrowProps {
  id: string;
  /** Absent when the arrow can't move: it renders a disabled button instead of a link. */
  href?: string;
  children: ReactNode;
}

export default function PaginationArrow({ id, href, children }: PaginationArrowProps) {
  if (!href) {
    return (
      <button id={id} type="button" className="pagination-arrow" disabled>
        {children}
      </button>
    );
  }

  return (
    <Link id={id} href={href} className="pagination-arrow">
      {children}
      <LinkPendingLoader />
    </Link>
  );
}
