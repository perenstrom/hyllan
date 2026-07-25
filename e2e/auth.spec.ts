import { expect, test } from "@playwright/test";
import postgres from "postgres";

test("signup creates a household, then login and sign out both work", async ({
  page,
}) => {
  const email = `e2e-${Date.now()}@example.com`;
  const password = "correct horse battery staple";

  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign up" }).click();

  await expect(page.getByText("Your pantry is empty.")).toBeVisible();

  const sql = postgres(process.env.DATABASE_URL!);
  try {
    const rows = await sql`
      SELECT h.id FROM households h
      JOIN auth.users u ON u.id = h.user_id
      WHERE u.email = ${email}
    `;
    expect(rows).toHaveLength(1);
  } finally {
    await sql.end();
  }

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page.getByText("Your pantry is empty.")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
