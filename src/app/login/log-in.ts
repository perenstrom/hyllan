import { parseCredentials } from "@/lib/parse-credentials";
import { createClient } from "@/lib/supabase/client";

export type LogInResult = { error: string } | { success: true };

// Client-side (not a Server Action) since it uses the browser Supabase
// client — the page's effect handles navigation once state flips to
// `success`, keeping this function itself easy to unit test.
export async function logIn(
  _prevState: LogInResult | undefined,
  formData: FormData,
): Promise<LogInResult> {
  const credentials = parseCredentials(formData);
  if (!credentials) {
    return { error: "Email and password are required." };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
