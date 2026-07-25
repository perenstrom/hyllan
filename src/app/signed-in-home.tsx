import { AccountMenu } from "./account-menu";

// Placeholder until PER-225 (pantry item list + add item) builds the real
// table here — this is what proves the account menu shows on a signed-in
// page (PER-224's scope is auth, not the pantry UI itself).
export function SignedInHome() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <span className="font-semibold text-black dark:text-zinc-50">
          Hyllan
        </span>
        <AccountMenu />
      </header>
      <main className="flex flex-1 items-center justify-center px-6 text-center">
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Your pantry is empty.
        </p>
      </main>
    </div>
  );
}
