import { parsePasswordChange } from "@/lib/parse-password-change";
import { createClient } from "@/lib/supabase/client";

export type ChangePasswordResult = { error: string } | { success: true };

// Client-side (not a Server Action) since it uses the browser Supabase
// client, mirroring `logIn` (src/app/login/log-in.ts). `email` comes from
// the signed-in user's session claims (read server-side on the account
// page) rather than the form itself, since re-verifying the current
// password is done by replaying it through signInWithPassword.
export async function changePassword(
  email: string,
  _prevState: ChangePasswordResult | undefined,
  formData: FormData,
): Promise<ChangePasswordResult> {
  const fields = parsePasswordChange(formData);
  if (!fields) {
    return { error: "All fields are required." };
  }

  if (fields.newPassword !== fields.confirmNewPassword) {
    return { error: "New password and confirmation do not match." };
  }

  const supabase = createClient();

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email,
    password: fields.currentPassword,
  });
  if (verifyError) {
    return { error: "Current password is incorrect." };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: fields.newPassword,
  });
  if (updateError) {
    return { error: updateError.message };
  }

  return { success: true };
}
