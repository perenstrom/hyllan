import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { verifyWebhookSignature } from "./webhook-signature";

const SECRET_BYTES = Buffer.from("test-secret-bytes-000000000000");
const SECRET = `v1,whsec_${SECRET_BYTES.toString("base64")}`;

function sign(id: string, timestamp: string, payload: string) {
  const signature = createHmac("sha256", SECRET_BYTES)
    .update(`${id}.${timestamp}.${payload}`)
    .digest("base64");
  return `v1,${signature}`;
}

function headersFor(id: string, timestamp: string, payload: string) {
  return {
    "webhook-id": id,
    "webhook-timestamp": timestamp,
    "webhook-signature": sign(id, timestamp, payload),
  };
}

describe("verifyWebhookSignature", () => {
  it("accepts a correctly signed payload", () => {
    const payload = JSON.stringify({ hello: "world" });
    const timestamp = String(Math.floor(Date.now() / 1000));

    expect(
      verifyWebhookSignature(
        payload,
        headersFor("msg-1", timestamp, payload),
        SECRET,
      ),
    ).toBe(true);
  });

  it("accepts a match against any signature in a space-delimited list", () => {
    const payload = JSON.stringify({ hello: "world" });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const headers = headersFor("msg-1", timestamp, payload);

    expect(
      verifyWebhookSignature(
        payload,
        {
          ...headers,
          "webhook-signature": `v1,bm90LXRoZS1yaWdodC1zaWc= ${headers["webhook-signature"]}`,
        },
        SECRET,
      ),
    ).toBe(true);
  });

  it("rejects a payload that doesn't match the signed content", () => {
    const payload = JSON.stringify({ hello: "world" });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const headers = headersFor("msg-1", timestamp, payload);

    expect(
      verifyWebhookSignature(
        JSON.stringify({ hello: "tampered" }),
        headers,
        SECRET,
      ),
    ).toBe(false);
  });

  it("rejects a signature produced with the wrong secret", () => {
    const payload = JSON.stringify({ hello: "world" });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const headers = headersFor("msg-1", timestamp, payload);

    expect(
      verifyWebhookSignature(
        payload,
        headers,
        `v1,whsec_${Buffer.from("a-completely-different-secret!!").toString("base64")}`,
      ),
    ).toBe(false);
  });

  it("rejects a timestamp outside the tolerance window", () => {
    const payload = JSON.stringify({ hello: "world" });
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 10 * 60);

    expect(
      verifyWebhookSignature(
        payload,
        headersFor("msg-1", staleTimestamp, payload),
        SECRET,
      ),
    ).toBe(false);
  });

  it("rejects a request missing any of the required headers", () => {
    const payload = JSON.stringify({ hello: "world" });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const headers = headersFor("msg-1", timestamp, payload);

    expect(
      verifyWebhookSignature(
        payload,
        { ...headers, "webhook-id": null },
        SECRET,
      ),
    ).toBe(false);
  });
});
