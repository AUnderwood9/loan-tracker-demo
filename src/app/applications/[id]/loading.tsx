import Loader from "@/components/Loader";
import { UI_TEXT } from "@/lib/ui/ui-text";

export default function ApplicationLoading() {
  return <Loader label={UI_TEXT.loadingApplication} />;
}
