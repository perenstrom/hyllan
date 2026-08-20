import type { SupabaseClient } from "@supabase/supabase-js";

import { parseNewPassword } from "@/lib/parse-new-password";

export type UpdatePasswordResult = { error: string } | { success: true };

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
  const fields = parseNewPassword(formData);
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
