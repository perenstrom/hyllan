import { createClient } from "@/lib/supabase/client";

export type RequestPasswordResetResult = { error: string } | { success: true };

// Client-side (not a Server Action) since it uses the browser Supabase
// client, mirroring `logIn` (src/app/login/log-in.ts). Always reports
// success once GoTrue accepts the request — GoTrue's own /recover endpoint
// doesn't reveal whether the email belongs to an account, so relaying an
// error here would only ever be a genuine failure (network, rate limit),
// never "no such account".
export async function requestPasswordReset(
  _prevState: RequestPasswordResetResult | undefined,
  formData: FormData,
): Promise<RequestPasswordResetResult> {
  const email = formData.get("email");
  if (typeof email !== "string" || !email) {
    return { error: "Email is required." };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
