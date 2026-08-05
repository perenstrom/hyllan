export type PasswordChange = {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
};

export function parsePasswordChange(formData: FormData): PasswordChange | null {
  const currentPassword = formData.get("currentPassword");
  const newPassword = formData.get("newPassword");
  const confirmNewPassword = formData.get("confirmNewPassword");

  if (
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string" ||
    typeof confirmNewPassword !== "string" ||
    !currentPassword ||
    !newPassword ||
    !confirmNewPassword
  ) {
    return null;
  }

  return { currentPassword, newPassword, confirmNewPassword };
}
