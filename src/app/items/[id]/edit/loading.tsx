import { AppHeader } from "@/app/app-header";
import { LoadingIndicator } from "@/app/loading-indicator";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <LoadingIndicator />
    </div>
  );
}
