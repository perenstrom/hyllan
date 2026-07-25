export type Credentials = { email: string; password: string };

export function parseCredentials(formData: FormData): Credentials | null {
  const email = formData.get("email");
  const password = formData.get("password");

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email ||
    !password
  ) {
    return null;
  }

  return { email, password };
}
