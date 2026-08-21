import { NextResponse, type NextRequest } from "next/server";

import { logger } from "@/lib/logger";
import { verifyWebhookSignature } from "@/lib/webhook-signature";

type SendEmailPayload = {
  user: { email: string };
  email_data: {
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
  };
};

// GoTrue's Send Email Hook (GOTRUE_HOOK_SEND_EMAIL_* in compose.yaml, local
// dev only — see PER-263) posts here instead of sending mail over SMTP,
// which local dev doesn't configure. This logs the confirmation link a real
// email would have contained, so the forgot-password flow (PER-252) can be
// exercised end-to-end without a mail provider.
export async function POST(request: NextRequest) {
  // Defense-in-depth on top of GOTRUE_HOOK_SEND_EMAIL_SECRETS only ever
  // being set locally (compose.yaml) — a built app (`next build`/`next
  // start`, what staging and production run) always has NODE_ENV
  // "production", so this refuses to run there even if that secret were
  // ever accidentally set, rather than silently swallowing real recovery
  // emails behind a log line no one is watching.
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  const secret = process.env.GOTRUE_HOOK_SEND_EMAIL_SECRETS;
  if (!secret) {
    return NextResponse.json(
      { error: { http_code: 500, message: "Hook secret not configured" } },
      { status: 500 },
    );
  }

  const payload = await request.text();
  const verified = verifyWebhookSignature(
    payload,
    {
      "webhook-id": request.headers.get("webhook-id"),
      "webhook-timestamp": request.headers.get("webhook-timestamp"),
      "webhook-signature": request.headers.get("webhook-signature"),
    },
    secret,
  );

  if (!verified) {
    return NextResponse.json(
      { error: { http_code: 401, message: "Invalid signature" } },
      { status: 401 },
    );
  }

  const { user, email_data } = JSON.parse(payload) as SendEmailPayload;

  // Mirrors the ConfirmationURL GoTrue's own email templates build
  // ({{ .SiteURL }}/verify?token={{ .TokenHash }}&type=...&redirect_to=...),
  // routed through the app's own /auth/v1 rewrite (next.config.ts) rather
  // than GoTrue's external URL directly, same as a real email link would be.
  const confirmationUrl = `${email_data.site_url}/auth/v1/verify?${new URLSearchParams(
    {
      token: email_data.token_hash,
      type: email_data.email_action_type,
      redirect_to: email_data.redirect_to,
    },
  ).toString()}`;

  logger.info(
    { email: user.email, type: email_data.email_action_type, confirmationUrl },
    "dev: GoTrue email intercepted by send-email-hook — open the link above instead of checking mail",
  );

  return NextResponse.json({});
}
