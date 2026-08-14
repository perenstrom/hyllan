import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalFetch = global.fetch;

async function loadInternalFetchModule(internalUrl: string | undefined) {
  vi.resetModules();
  if (internalUrl === undefined) {
    delete process.env.GOTRUE_API_INTERNAL_URL;
  } else {
    process.env.GOTRUE_API_INTERNAL_URL = internalUrl;
  }
  return import("./internal-fetch");
}

describe("internalGoTrueFetch", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue(new Response(null));
  });

  afterEach(() => {
    delete process.env.GOTRUE_API_INTERNAL_URL;
    global.fetch = originalFetch;
  });

  it("returns undefined when GOTRUE_API_INTERNAL_URL is unset", async () => {
    const { internalGoTrueFetch } = await loadInternalFetchModule(undefined);

    expect(internalGoTrueFetch()).toBeUndefined();
  });

  it("reroutes an /auth/v1 request to the internal URL, stripping the prefix", async () => {
    const { internalGoTrueFetch } = await loadInternalFetchModule(
      "http://auth:9999",
    );

    const fetchOverride = internalGoTrueFetch()!;
    await fetchOverride("https://app.example.com/auth/v1/user", {
      method: "GET",
    });

    expect(global.fetch).toHaveBeenCalledExactlyOnceWith(
      "http://auth:9999/user",
      { method: "GET" },
    );
  });

  it("preserves the query string when rerouting", async () => {
    const { internalGoTrueFetch } = await loadInternalFetchModule(
      "http://auth:9999",
    );

    const fetchOverride = internalGoTrueFetch()!;
    await fetchOverride(
      "https://app.example.com/auth/v1/token?grant_type=refresh_token",
    );

    expect(global.fetch).toHaveBeenCalledExactlyOnceWith(
      "http://auth:9999/token?grant_type=refresh_token",
      undefined,
    );
  });

  it("leaves a request untouched if it doesn't target /auth/v1", async () => {
    const { internalGoTrueFetch } = await loadInternalFetchModule(
      "http://auth:9999",
    );

    const fetchOverride = internalGoTrueFetch()!;
    await fetchOverride("https://app.example.com/api/health");

    expect(global.fetch).toHaveBeenCalledExactlyOnceWith(
      "https://app.example.com/api/health",
      undefined,
    );
  });

  it("accepts a URL object as input", async () => {
    const { internalGoTrueFetch } = await loadInternalFetchModule(
      "http://auth:9999",
    );

    const fetchOverride = internalGoTrueFetch()!;
    await fetchOverride(new URL("https://app.example.com/auth/v1/user"));

    expect(global.fetch).toHaveBeenCalledExactlyOnceWith(
      "http://auth:9999/user",
      undefined,
    );
  });
});

describe("internalGoTrueClientOptions", () => {
  afterEach(() => {
    delete process.env.GOTRUE_API_INTERNAL_URL;
  });

  it("returns an empty object when GOTRUE_API_INTERNAL_URL is unset", async () => {
    const { internalGoTrueClientOptions } =
      await loadInternalFetchModule(undefined);

    expect(internalGoTrueClientOptions()).toEqual({});
  });

  it("wraps the fetch override under global.fetch when configured", async () => {
    const { internalGoTrueClientOptions } = await loadInternalFetchModule(
      "http://auth:9999",
    );

    expect(internalGoTrueClientOptions().global?.fetch).toBeInstanceOf(
      Function,
    );
  });
});
