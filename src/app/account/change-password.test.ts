import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithPasswordMock = vi.fn();
const updateUserMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: signInWithPasswordMock,
      updateUser: updateUserMock,
    },
  }),
}));

const { changePassword } = await import("./change-password");

function formDataOf(
  currentPassword: string,
  newPassword: string,
  confirmNewPassword: string,
) {
  const formData = new FormData();
  formData.set("currentPassword", currentPassword);
  formData.set("newPassword", newPassword);
  formData.set("confirmNewPassword", confirmNewPassword);
  return formData;
}

describe("changePassword", () => {
  beforeEach(() => {
    signInWithPasswordMock.mockReset();
    updateUserMock.mockReset();
  });

  it("verifies the current password, updates it, and returns success", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: null });
    updateUserMock.mockResolvedValue({ error: null });

    const result = await changePassword(
      "user@example.com",
      undefined,
      formDataOf("oldpass1", "newpass1", "newpass1"),
    );

    expect(signInWithPasswordMock).toHaveBeenCalledExactlyOnceWith({
      email: "user@example.com",
      password: "oldpass1",
    });
    expect(updateUserMock).toHaveBeenCalledExactlyOnceWith({
      password: "newpass1",
    });
    expect(result).toEqual({ success: true });
  });

  it("rejects an incorrect current password without updating it", async () => {
    signInWithPasswordMock.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });

    const result = await changePassword(
      "user@example.com",
      undefined,
      formDataOf("wrongpass", "newpass1", "newpass1"),
    );

    expect(result).toEqual({ error: "Current password is incorrect." });
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("rejects a mismatched confirmation without calling Supabase at all", async () => {
    const result = await changePassword(
      "user@example.com",
      undefined,
      formDataOf("oldpass1", "newpass1", "different"),
    );

    expect(result).toEqual({
      error: "New password and confirmation do not match.",
    });
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("relays the auth provider's rejection of the new password verbatim", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: null });
    updateUserMock.mockResolvedValue({
      error: { message: "Password should be at least 6 characters." },
    });

    const result = await changePassword(
      "user@example.com",
      undefined,
      formDataOf("oldpass1", "short", "short"),
    );

    expect(result).toEqual({
      error: "Password should be at least 6 characters.",
    });
  });

  it("returns a validation error without calling Supabase for a missing field", async () => {
    const result = await changePassword(
      "user@example.com",
      undefined,
      formDataOf("oldpass1", "newpass1", ""),
    );

    expect(result).toEqual({ error: "All fields are required." });
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
    expect(updateUserMock).not.toHaveBeenCalled();
  });
});
