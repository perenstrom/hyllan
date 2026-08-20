import { beforeEach, describe, expect, it, vi } from "vitest";

import { updatePassword } from "./update-password";

const updateUserMock = vi.fn();
const supabase = { auth: { updateUser: updateUserMock } } as never;

function formDataOf(newPassword: string, confirmNewPassword: string) {
  const formData = new FormData();
  formData.set("newPassword", newPassword);
  formData.set("confirmNewPassword", confirmNewPassword);
  return formData;
}

describe("updatePassword", () => {
  beforeEach(() => {
    updateUserMock.mockReset();
  });

  it("updates the password on the given client and returns success", async () => {
    updateUserMock.mockResolvedValue({ error: null });

    const result = await updatePassword(
      supabase,
      undefined,
      formDataOf("newpass1", "newpass1"),
    );

    expect(updateUserMock).toHaveBeenCalledExactlyOnceWith({
      password: "newpass1",
    });
    expect(result).toEqual({ success: true });
  });

  it("rejects a mismatched confirmation without calling Supabase", async () => {
    const result = await updatePassword(
      supabase,
      undefined,
      formDataOf("newpass1", "different"),
    );

    expect(result).toEqual({
      error: "New password and confirmation do not match.",
    });
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("relays the auth provider's rejection of the new password verbatim", async () => {
    updateUserMock.mockResolvedValue({
      error: { message: "Password should be at least 6 characters." },
    });

    const result = await updatePassword(
      supabase,
      undefined,
      formDataOf("short", "short"),
    );

    expect(result).toEqual({
      error: "Password should be at least 6 characters.",
    });
  });

  it("returns a validation error without calling Supabase for a missing field", async () => {
    const result = await updatePassword(
      supabase,
      undefined,
      formDataOf("newpass1", ""),
    );

    expect(result).toEqual({ error: "All fields are required." });
    expect(updateUserMock).not.toHaveBeenCalled();
  });
});
