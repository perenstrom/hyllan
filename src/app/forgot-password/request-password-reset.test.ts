import { beforeEach, describe, expect, it, vi } from "vitest";

const resetPasswordForEmailMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { resetPasswordForEmail: resetPasswordForEmailMock },
  }),
}));

const { requestPasswordReset } = await import("./request-password-reset");

function formDataOf(email: string) {
  const formData = new FormData();
  formData.set("email", email);
  return formData;
}

describe("requestPasswordReset", () => {
  beforeEach(() => {
    resetPasswordForEmailMock.mockReset();
  });

  it("requests a recovery email with a redirect back to /reset-password", async () => {
    resetPasswordForEmailMock.mockResolvedValue({ error: null });

    const result = await requestPasswordReset(
      undefined,
      formDataOf("user@example.com"),
    );

    expect(resetPasswordForEmailMock).toHaveBeenCalledExactlyOnceWith(
      "user@example.com",
      { redirectTo: "http://localhost:3000/reset-password" },
    );
    expect(result).toEqual({ success: true });
  });

  it("relays a genuine failure from the auth provider", async () => {
    resetPasswordForEmailMock.mockResolvedValue({
      error: { message: "Email rate limit exceeded" },
    });

    const result = await requestPasswordReset(
      undefined,
      formDataOf("user@example.com"),
    );

    expect(result).toEqual({ error: "Email rate limit exceeded" });
  });

  it("returns a validation error without calling Supabase for a missing email", async () => {
    const result = await requestPasswordReset(undefined, formDataOf(""));

    expect(result).toEqual({ error: "Email is required." });
    expect(resetPasswordForEmailMock).not.toHaveBeenCalled();
  });
});
