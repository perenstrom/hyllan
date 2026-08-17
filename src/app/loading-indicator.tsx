// Minimal shared fallback for every route's loading.tsx (PER-272) — shown
// immediately on navigation, before the destination page's server response
// lands, so a slow auth/data round trip renders as a status message rather
// than a blank/frozen screen.
export function LoadingIndicator() {
  return (
    <div
      role="status"
      className="flex flex-1 items-center justify-center text-lg text-zinc-600 dark:text-zinc-400"
    >
      Loading…
    </div>
  );
}
