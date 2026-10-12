import { BatchEntry } from "../batch-entry";
import { loadBatchItems } from "../load-batch-items";
import { AppHeader } from "@/app/app-header";

export default async function BatchAddPage() {
  const items = await loadBatchItems();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <AppHeader />
      <BatchEntry direction="add" items={items} />
    </div>
  );
}
