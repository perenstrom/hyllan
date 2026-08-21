export type NewPassword = { newPassword: string; confirmNewPassword: string };

export function parseNewPassword(formData: FormData): NewPassword | null {
  const newPassword = formData.get("newPassword");
  const confirmNewPassword = formData.get("confirmNewPassword");

  if (
    typeof newPassword !== "string" ||
    typeof confirmNewPassword !== "string" ||
    !newPassword ||
    !confirmNewPassword
  ) {
    return null;
  }

  return { newPassword, confirmNewPassword };
}
