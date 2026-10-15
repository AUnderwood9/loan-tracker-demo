import BackToApplicationsLink from "@/components/BackToApplicationsLink";
import { ELEMENT_IDS } from "@/lib/ui/element-ids";
import { UI_TEXT } from "@/lib/ui/ui-text";

export default function ApplicationNotFound() {
  return (
    <section id={ELEMENT_IDS.applicationNotFound}>
      <h1>{UI_TEXT.applicationNotFound}</h1>
      <BackToApplicationsLink />
    </section>
  );
}
