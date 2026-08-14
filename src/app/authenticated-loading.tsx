import { AppHeader } from "@/app/app-header";
import { LoadingIndicator } from "@/app/loading-indicator";

type Props = {
  // Matches the destination page's own wrapper classes (PER-272) so the
  // loading state doesn't visually jump once the real page mounts — e.g.
  // account/page.tsx sets a background the edit/new item pages don't.
  className?: string;
};

// Shared by every authenticated top-level route's loading.tsx (edit item,
// new item, account). The root route's loading.tsx doesn't use this: it
// can't show AppHeader before knowing whether the visitor is signed in, and
// the signed-out home has no header at all.
export function AuthenticatedLoading({
  className = "flex flex-1 flex-col",
}: Props) {
  return (
    <div className={className}>
      <AppHeader />
      <LoadingIndicator />
    </div>
  );
}
