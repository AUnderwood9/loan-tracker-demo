import { UI_TEXT, outstandingLabel } from "@/lib/ui/ui-text";

interface ApplicationStatusBadgeProps {
  isComplete: boolean;
  outstandingCount: number;
}

export default function ApplicationStatusBadge({
  isComplete,
  outstandingCount,
}: ApplicationStatusBadgeProps) {
  return isComplete ? (
    <span className="status-badge status-badge-complete">{UI_TEXT.complete}</span>
  ) : (
    <span className="status-badge status-badge-outstanding">
      {outstandingLabel(outstandingCount)}
    </span>
  );
}
