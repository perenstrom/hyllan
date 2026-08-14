import { LoadingIndicator } from "./loading-indicator";

// No AppHeader here (unlike the other top-level loading states) — this
// route serves both signed-in and signed-out content, and the signed-out
// view has no header, so showing one here would flash and disappear.
export default function Loading() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <LoadingIndicator />
    </div>
  );
}
