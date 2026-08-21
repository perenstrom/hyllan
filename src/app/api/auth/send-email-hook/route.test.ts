import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loggerInfoMock = vi.fn();

vi.mock("@/lib/logger", () => ({
  logger: { info: (...args: unknown[]) => loggerInfoMock(...args) },
}));

const { POST } = await import("./route");

const SECRET_BYTES = Buffer.from("test-secret-bytes-000000000000");
const SECRET = `v1,whsec_${SECRET_BYTES.toString("base64")}`;

function requestFor(payload: string, signatureOverride?: string) {
  const id = "msg-1";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature =
    signatureOverride ??
    `v1,${createHmac("sha256", SECRET_BYTES)
      .update(`${id}.${timestamp}.${payload}`)
      .digest("base64")}`;

  return new NextRequest("http://localhost:3000/api/auth/send-email-hook", {
    method: "POST",
    headers: {
      "webhook-id": id,
      "webhook-timestamp": timestamp,
      "webhook-signature": signature,
    },
    body: payload,
  });
}

describe("POST /api/auth/send-email-hook", () => {
  beforeEach(() => {
    loggerInfoMock.mockReset();
    process.env.GOTRUE_HOOK_SEND_EMAIL_SECRETS = SECRET;
  });

  afterEach(() => {
    delete process.env.GOTRUE_HOOK_SEND_EMAIL_SECRETS;
  });

  it("logs the confirmation link and returns 200 for a correctly signed request", async () => {
    const payload = JSON.stringify({
      user: { email: "user@example.com" },
      email_data: {
        token_hash: "token-hash-value",
        redirect_to: "http://localhost:3000/reset-password",
        email_action_type: "recovery",
        site_url: "http://localhost:3000",
      },
    });

    const response = await POST(requestFor(payload));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});
    expect(loggerInfoMock).toHaveBeenCalledExactlyOnceWith(
      {
        email: "user@example.com",
        type: "recovery",
        confirmationUrl:
          "http://localhost:3000/auth/v1/verify?token=token-hash-value&type=recovery&redirect_to=http%3A%2F%2Flocalhost%3A3000%2Freset-password",
      },
      expect.any(String),
    );
  });

  it("rejects a request with an invalid signature and does not log anything", async () => {
    const payload = JSON.stringify({
      user: { email: "user@example.com" },
      email_data: {
        token_hash: "token-hash-value",
        redirect_to: "http://localhost:3000/reset-password",
        email_action_type: "recovery",
        site_url: "http://localhost:3000",
      },
    });

    const response = await POST(requestFor(payload, "v1,dGFtcGVyZWQ="));

    expect(response.status).toBe(401);
    expect(loggerInfoMock).not.toHaveBeenCalled();
  });

  it("returns 500 when no hook secret is configured", async () => {
    delete process.env.GOTRUE_HOOK_SEND_EMAIL_SECRETS;
    const payload = JSON.stringify({
      user: { email: "user@example.com" },
      email_data: {
        token_hash: "token-hash-value",
        redirect_to: "http://localhost:3000/reset-password",
        email_action_type: "recovery",
        site_url: "http://localhost:3000",
      },
    });

    const response = await POST(requestFor(payload));

    expect(response.status).toBe(500);
  });

  it("refuses to run in a production build even with a valid signature", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const payload = JSON.stringify({
      user: { email: "user@example.com" },
      email_data: {
        token_hash: "token-hash-value",
        redirect_to: "http://localhost:3000/reset-password",
        email_action_type: "recovery",
        site_url: "http://localhost:3000",
      },
    });

    const response = await POST(requestFor(payload));

    expect(response.status).toBe(404);
    expect(loggerInfoMock).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});
