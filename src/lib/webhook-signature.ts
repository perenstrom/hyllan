import { createHmac, timingSafeEqual } from "node:crypto";

// 5 minutes, matching the default tolerance of the standardwebhooks
// libraries GoTrue's own docs point to for verifying this scheme.
const TOLERANCE_SECONDS = 5 * 60;

export type WebhookHeaders = {
  "webhook-id": string | null;
  "webhook-timestamp": string | null;
  "webhook-signature": string | null;
};

// Verifies a Standard Webhooks-signed request (the scheme GoTrue's Send
// Email Hook uses — see https://www.standardwebhooks.com/) against a
// `v1,whsec_<base64>`-formatted secret (GOTRUE_HOOK_SEND_EMAIL_SECRETS).
// `payload` must be the exact raw request body string GoTrue signed, not a
// re-serialized copy — re-encoding JSON can reorder keys or change
// whitespace and would make a genuine signature fail to match.
export function verifyWebhookSignature(
  payload: string,
  headers: WebhookHeaders,
  secret: string,
): boolean {
  const id = headers["webhook-id"];
  const timestamp = headers["webhook-timestamp"];
  const signatureHeader = headers["webhook-signature"];
  if (!id || !timestamp || !signatureHeader) {
    return false;
  }

  const timestampSeconds = Number(timestamp);
  if (
    !Number.isFinite(timestampSeconds) ||
    Math.abs(Date.now() / 1000 - timestampSeconds) > TOLERANCE_SECONDS
  ) {
    return false;
  }

  const secretBytes = Buffer.from(secret.replace(/^v1,whsec_/, ""), "base64");
  const expected = createHmac("sha256", secretBytes)
    .update(`${id}.${timestamp}.${payload}`)
    .digest();

  // Space-delimited list of `v1,<base64>` candidates (supports secret
  // rotation) — a match against any one of them is a valid signature.
  return signatureHeader.split(" ").some((candidate) => {
    const [, signatureBase64] = candidate.split(",");
    if (!signatureBase64) {
      return false;
    }
    const provided = Buffer.from(signatureBase64, "base64");
    return (
      provided.length === expected.length && timingSafeEqual(provided, expected)
    );
  });
}
