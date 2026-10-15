import Loader from "@/components/Loader";
import { UI_TEXT } from "@/lib/ui/ui-text";

export default function ApplicationsLoading() {
  return <Loader label={UI_TEXT.loadingApplications} />;
}
