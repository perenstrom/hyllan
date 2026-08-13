// Testing-only utility (PER-262): mints a session that authenticates
// against this app's own GoTrue instance without a live signup/login
// call — signed with the same GOTRUE_JWT_SECRET GoTrue itself signs with,
// in the same claim shape a real login produces, and cookie-encoded the
// same way @supabase/ssr's createServerClient reads it. Used by the
// screenshot capture tool (screenshots/) to authenticate a browser context
// directly. Never imported from application code.
import crypto from "node:crypto";

export type MockSessionUser = {
  id: string;
  email: string;
};

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// GoTrue signs access tokens with GOTRUE_JWT_SECRET over HS256
// (compose.yaml has no asymmetric signing keys configured) — verified
// empirically against a real GoTrue instance's `/user` endpoint, which
// accepts a hand-signed token in this exact shape with no live session row
// required.
export function mintAccessToken(
  jwtSecret: string,
  user: MockSessionUser,
  issuedAt: number = Math.floor(Date.now() / 1000),
): string {
  const header = { alg: "HS256", typ: "JWT" };
  // GOTRUE_JWT_EXP in compose.yaml/.env.example is 3600 seconds.
  const expiresInSeconds = 3600;
  const payload = {
    aud: "authenticated",
    exp: issuedAt + expiresInSeconds,
    iat: issuedAt,
    sub: user.id,
    email: user.email,
    phone: "",
    role: "authenticated",
    aal: "aal1",
    amr: [{ method: "password", timestamp: issuedAt }],
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    is_anonymous: false,
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = base64url(
    crypto.createHmac("sha256", jwtSecret).update(signingInput).digest(),
  );

  return `${signingInput}.${signature}`;
}

type MockSessionCookieParams = {
  // The app's own origin (NEXT_PUBLIC_SUPABASE_URL) — not GoTrue's. Used
  // only to derive the cookie name, the same way @supabase/ssr's
  // SupabaseClient derives its default storageKey from the URL's hostname.
  supabaseUrl: string;
  jwtSecret: string;
  user: MockSessionUser;
};

// @supabase/ssr's createServerClient defaults to `sb-${hostname's first
// label}-auth-token` when no cookieOptions.name is configured (this app
// doesn't configure one — see src/lib/supabase/server.ts).
function cookieNameFor(supabaseUrl: string): string {
  const hostname = new URL(supabaseUrl).hostname;
  return `sb-${hostname.split(".")[0]}-auth-token`;
}

// Builds the same cookie shape @supabase/ssr writes on a real sign-in: the
// full Session object (access token, refresh token, and user), JSON-encoded
// and base64url-encoded with the "base64-" prefix @supabase/ssr's default
// cookieEncoding ("base64url") uses.
export function buildMockSessionCookie({
  supabaseUrl,
  jwtSecret,
  user,
}: MockSessionCookieParams): { name: string; value: string } {
  const issuedAt = Math.floor(Date.now() / 1000);
  const accessToken = mintAccessToken(jwtSecret, user, issuedAt);
  const expiresInSeconds = 3600;

  const nowIso = new Date(issuedAt * 1000).toISOString();
  const session = {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: expiresInSeconds,
    expires_at: issuedAt + expiresInSeconds,
    // Never exchanged against GoTrue's /token endpoint — the mock session
    // never expires within a capture run's lifetime, so no refresh is ever
    // attempted.
    refresh_token: "mock-refresh-token-unused",
    user: {
      id: user.id,
      aud: "authenticated",
      role: "authenticated",
      email: user.email,
      email_confirmed_at: nowIso,
      phone: "",
      confirmed_at: nowIso,
      last_sign_in_at: nowIso,
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {},
      identities: [],
      created_at: nowIso,
      updated_at: nowIso,
      is_anonymous: false,
    },
  };

  return {
    name: cookieNameFor(supabaseUrl),
    value: `base64-${base64url(JSON.stringify(session))}`,
  };
}
