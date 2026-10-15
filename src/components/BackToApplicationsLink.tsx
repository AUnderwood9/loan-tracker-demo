import Link from "next/link";
import { ELEMENT_IDS } from "@/lib/ui/element-ids";
import { ROUTES } from "@/lib/ui/routes";
import { UI_TEXT } from "@/lib/ui/ui-text";

export default function BackToApplicationsLink() {
  return (
    <Link id={ELEMENT_IDS.backToApplications} href={ROUTES.applications}>
      {UI_TEXT.backToApplications}
    </Link>
  );
}
