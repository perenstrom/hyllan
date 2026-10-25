import { AccountActions } from "./account-actions";
import { ChangePasswordForm } from "./change-password-form";
import { AppHeader } from "@/app/app-header";
import { PANEL_CARD_CLASS, PANEL_MAIN_CLASS } from "@/app/panel-styles";
import { requireSessionClaims } from "@/lib/auth";

export default async function AccountPage() {
  const { claims } = await requireSessionClaims();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <AppHeader />
      <main className={PANEL_MAIN_CLASS}>
        <div className={PANEL_CARD_CLASS}>
          <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
            Account
          </h1>
          <AccountActions />
        </div>

        <div className={PANEL_CARD_CLASS}>
          <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
            Change password
          </h2>
          {/* email is a required claim for password-based accounts, the only auth method this app has */}
          <ChangePasswordForm email={claims.email!} />
        </div>
      </main>
    </div>
  );
}
