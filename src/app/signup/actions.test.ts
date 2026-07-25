import { beforeEach, describe, expect, it, vi } from "vitest";

const signUpMock = vi.fn();
const createHouseholdForUserMock = vi.fn();
const redirectMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signUp: signUpMock } }),
}));

vi.mock("@/lib/household", () => ({
  createHouseholdForUser: createHouseholdForUserMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/db/client", () => ({ db: {} }));

const { signUp } = await import("./actions");

function formDataOf(email: string, password: string) {
  const formData = new FormData();
  formData.set("email", email);
  formData.set("password", password);
  return formData;
}

describe("signUp", () => {
  beforeEach(() => {
    signUpMock.mockReset();
    createHouseholdForUserMock.mockReset();
    redirectMock.mockReset();
  });

  it("creates a household for the new user and redirects home on success", async () => {
    signUpMock.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    await signUp(undefined, formDataOf("new@example.com", "hunter22"));

    expect(createHouseholdForUserMock).toHaveBeenCalledExactlyOnceWith(
      {},
      "user-1",
    );
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("does not create a household or redirect when signup fails", async () => {
    signUpMock.mockResolvedValue({
      data: { user: null },
      error: { message: "User already registered" },
    });

    const state = await signUp(
      undefined,
      formDataOf("dup@example.com", "hunter22"),
    );

    expect(state).toEqual({ error: "User already registered" });
    expect(createHouseholdForUserMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("returns a validation error without calling Supabase for a missing field", async () => {
    const state = await signUp(undefined, formDataOf("", "hunter22"));

    expect(state).toEqual({ error: "Email and password are required." });
    expect(signUpMock).not.toHaveBeenCalled();
    expect(createHouseholdForUserMock).not.toHaveBeenCalled();
  });
});
