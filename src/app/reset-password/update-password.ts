import type { SupabaseClient } from "@supabase/supabase-js";

export type UpdatePasswordResult = { error: string } | { success: true };

type NewPasswordFields = { newPassword: string; confirmNewPassword: string };

function parseNewPasswordFields(formData: FormData): NewPasswordFields | null {
  const newPassword = formData.get("newPassword");
  const confirmNewPassword = formData.get("confirmNewPassword");

  if (
    typeof newPassword !== "string" ||
    typeof confirmNewPassword !== "string" ||
    !newPassword ||
    !confirmNewPassword
  ) {
    return null;
  }

  return { newPassword, confirmNewPassword };
}

// Takes the page's own Supabase client rather than constructing one (unlike
// `changePassword`/`logIn`) — the recovery session this relies on only
// exists on the client instance that consumed the reset link's code from
// the URL on mount (src/app/reset-password/page.tsx); a second
// `createClient()` call here would re-run that URL detection against an
// already-consumed one-time code and fail.
export async function updatePassword(
  supabase: SupabaseClient,
  _prevState: UpdatePasswordResult | undefined,
  formData: FormData,
): Promise<UpdatePasswordResult> {
  const fields = parseNewPasswordFields(formData);
  if (!fields) {
    return { error: "All fields are required." };
  }

  if (fields.newPassword !== fields.confirmNewPassword) {
    return { error: "New password and confirmation do not match." };
  }

  const { error } = await supabase.auth.updateUser({
    password: fields.newPassword,
  });
  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
