import { ELEMENT_IDS } from "@/lib/ui/element-ids";

interface LoaderProps {
  label: string;
}

export default function Loader({ label }: LoaderProps) {
  return (
    <div id={ELEMENT_IDS.pageLoader} className="loader" role="status" aria-live="polite">
      <span className="loader-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
