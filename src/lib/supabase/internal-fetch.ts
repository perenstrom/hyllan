// @supabase/ssr's server-side clients always request
// `${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/...` (mimicking Kong's routing in the
// full Supabase stack); next.config.ts's rewrite strips the `/auth/v1`
// prefix and forwards to GoTrue. In staging/production, NEXT_PUBLIC_SUPABASE_URL
// is the app's own public domain, so that request leaves the container
// through Caddy over the public internet and comes back in through the
// rewrite (PER-272) — a full external round trip for what's really a
// same-network container-to-container call.
//
// GOTRUE_API_INTERNAL_URL, when set, is GoTrue's address on the internal
// Docker network `app` and `auth` already share (e.g. `http://auth:9999`
// in compose.yaml/compose.staging.yaml/compose.coolify.yaml). This reroutes
// server-side auth requests there directly, stripping the `/auth/v1`
// prefix here since GoTrue itself serves its routes unprefixed (the
// rewrite's job). The client is still constructed with the public
// NEXT_PUBLIC_SUPABASE_URL — only the actual network destination changes —
// so the hostname-derived cookie name it defaults to stays exactly what the
// browser client also defaults to.
const GOTRUE_INTERNAL_URL = process.env.GOTRUE_API_INTERNAL_URL;

const AUTH_V1_MARKER = "/auth/v1";

function rewriteToInternalUrl(url: string, internalUrl: string): string {
  const markerIndex = url.indexOf(AUTH_V1_MARKER);
  if (markerIndex === -1) {
    return url;
  }
  return `${internalUrl}${url.slice(markerIndex + AUTH_V1_MARKER.length)}`;
}

// Returns a fetch override for @supabase/ssr's `global.fetch` client option,
// or undefined when GOTRUE_API_INTERNAL_URL isn't configured (local dev,
// where NEXT_PUBLIC_SUPABASE_URL already points at the same machine and the
// public round trip this fixes doesn't exist).
export function internalGoTrueFetch(): typeof fetch | undefined {
  if (!GOTRUE_INTERNAL_URL) {
    return undefined;
  }
  const internalUrl = GOTRUE_INTERNAL_URL;

  return (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    return fetch(rewriteToInternalUrl(url, internalUrl), init);
  };
}
