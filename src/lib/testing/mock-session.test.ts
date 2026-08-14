import crypto from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildMockSessionCookie, mintAccessToken } from "./mock-session";

const SECRET = "test-only-secret";
const USER = { id: "11111111-1111-1111-1111-111111111111", email: "a@example.com" };

function base64urlDecode(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf8");
}

function decodeJwt(token: string) {
  const [header, payload, signature] = token.split(".");
  return {
    header: JSON.parse(base64urlDecode(header)),
    payload: JSON.parse(base64urlDecode(payload)),
    signature,
    signingInput: `${header}.${payload}`,
  };
}

function hmacSha256Base64Url(data: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

describe("mintAccessToken", () => {
  it("produces a JWT whose signature verifies against the given secret", () => {
    const token = mintAccessToken(SECRET, USER);
    const { signature, signingInput } = decodeJwt(token);
    expect(signature).toBe(hmacSha256Base64Url(signingInput, SECRET));
  });

  it("produces a signature that does not verify against a different secret", () => {
    const token = mintAccessToken(SECRET, USER);
    const { signature, signingInput } = decodeJwt(token);
    expect(signature).not.toBe(
      hmacSha256Base64Url(signingInput, "a-different-secret"),
    );
  });

  it("uses HS256 in the header, matching GoTrue's symmetric-secret tokens", () => {
    const { header } = decodeJwt(mintAccessToken(SECRET, USER));
    expect(header).toEqual({ alg: "HS256", typ: "JWT" });
  });

  it("carries claims matching the shape GoTrue's own tokens produce", () => {
    const { payload } = decodeJwt(mintAccessToken(SECRET, USER));
    expect(payload.sub).toBe(USER.id);
    expect(payload.email).toBe(USER.email);
    expect(payload.aud).toBe("authenticated");
    expect(payload.role).toBe("authenticated");
    expect(payload.is_anonymous).toBe(false);
    expect(typeof payload.iat).toBe("number");
    expect(typeof payload.exp).toBe("number");
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  it("sets exp exactly one hour after iat, matching GOTRUE_JWT_EXP", () => {
    const { payload } = decodeJwt(mintAccessToken(SECRET, USER));
    expect(payload.exp - payload.iat).toBe(3600);
  });
});

describe("buildMockSessionCookie", () => {
  it("derives the cookie name from the app origin's hostname, matching @supabase/ssr's default storage key", () => {
    const cookie = buildMockSessionCookie({
      supabaseUrl: "http://localhost:3000",
      jwtSecret: SECRET,
      user: USER,
    });
    expect(cookie.name).toBe("sb-localhost-auth-token");
  });

  it("derives the cookie name from a multi-label hostname's first label", () => {
    const cookie = buildMockSessionCookie({
      supabaseUrl: "https://myapp.example.com",
      jwtSecret: SECRET,
      user: USER,
    });
    expect(cookie.name).toBe("sb-myapp-auth-token");
  });

  it("prefixes the value with base64- and encodes a valid session as JSON underneath", () => {
    const cookie = buildMockSessionCookie({
      supabaseUrl: "http://localhost:3000",
      jwtSecret: SECRET,
      user: USER,
    });
    expect(cookie.value.startsWith("base64-")).toBe(true);

    const decoded = base64urlDecode(cookie.value.slice("base64-".length));
    const session = JSON.parse(decoded);

    expect(session.user.id).toBe(USER.id);
    expect(session.user.email).toBe(USER.email);
    expect(session.token_type).toBe("bearer");
    expect(typeof session.access_token).toBe("string");
    expect(session.access_token.split(".")).toHaveLength(3);
    expect(session.expires_in).toBe(3600);
    expect(typeof session.refresh_token).toBe("string");
  });

  it("embeds an access token whose signature verifies against the given secret", () => {
    const cookie = buildMockSessionCookie({
      supabaseUrl: "http://localhost:3000",
      jwtSecret: SECRET,
      user: USER,
    });
    const decoded = base64urlDecode(cookie.value.slice("base64-".length));
    const session = JSON.parse(decoded);
    const { signature, signingInput } = decodeJwt(session.access_token);
    expect(signature).toBe(hmacSha256Base64Url(signingInput, SECRET));
  });
});
