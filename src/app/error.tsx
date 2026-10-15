"use client";

import { ELEMENT_IDS } from "@/lib/ui/element-ids";
import { UI_TEXT } from "@/lib/ui/ui-text";

interface ErrorBoundaryProps {
  retry: () => void;
}

// Never renders `error`: the message can carry file paths and CSV headers (Q19).
export default function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <section id={ELEMENT_IDS.pageError} className="page-message" role="alert">
      <p>{UI_TEXT.errorMessage}</p>
      <button id={ELEMENT_IDS.pageErrorRetry} type="button" className="button" onClick={retry}>
        {UI_TEXT.errorRetry}
      </button>
    </section>
  );
}
