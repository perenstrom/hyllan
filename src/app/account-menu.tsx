import { signOut } from "./actions";

// A form (not a client-side dropdown) so the "menu present on any page"
// requirement works with zero client JS — ADR 0004's avatar dropdown can
// replace this once there's more than one action to offer.
export function AccountMenu() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
      >
        Sign out
      </button>
    </form>
  );
}
