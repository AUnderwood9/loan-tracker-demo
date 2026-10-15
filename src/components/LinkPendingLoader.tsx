"use client";

import { useLinkStatus } from "next/link";
import Loader from "@/components/Loader";
import { UI_TEXT } from "@/lib/ui/ui-text";

// A query-only navigation on "/" (sort or page) keeps the old table with no loading.tsx,
// so the pending signal has to come from the clicked link.
export default function LinkPendingLoader() {
  const { pending } = useLinkStatus();
  return pending ? <Loader label={UI_TEXT.loadingApplications} /> : null;
}
