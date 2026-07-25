import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithPasswordMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithPassword: signInWithPasswordMock },
  }),
}));

const { logIn } = await import("./log-in");

function formDataOf(email: string, password: string) {
  const formData = new FormData();
  formData.set("email", email);
  formData.set("password", password);
  return formData;
}

describe("logIn", () => {
  beforeEach(() => {
    signInWithPasswordMock.mockReset();
  });

  it("signs in and returns success", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: null });

    const result = await logIn(
      undefined,
      formDataOf("user@example.com", "hunter22"),
    );

    expect(signInWithPasswordMock).toHaveBeenCalledExactlyOnceWith({
      email: "user@example.com",
      password: "hunter22",
    });
    expect(result).toEqual({ success: true });
  });

  it("returns the auth error on invalid credentials", async () => {
    signInWithPasswordMock.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });

    const result = await logIn(
      undefined,
      formDataOf("user@example.com", "wrong"),
    );

    expect(result).toEqual({ error: "Invalid login credentials" });
  });

  it("returns a validation error without calling Supabase for a missing field", async () => {
    const result = await logIn(undefined, formDataOf("", "hunter22"));

    expect(result).toEqual({ error: "Email and password are required." });
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
  });
});
