import { AccountActions } from "./account-actions";
import { AppHeader } from "@/app/app-header";
import { requireSessionClaims } from "@/lib/auth";

export default async function AccountPage() {
  await requireSessionClaims();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <AppHeader />
      <main className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
          <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
            Account
          </h1>
          <AccountActions />
        </div>
      </main>
    </div>
  );
}
