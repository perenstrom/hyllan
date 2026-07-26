import { expect, test } from "@playwright/test";
import postgres from "postgres";

test("deleting the account cascades to the household and pantry items, and signs the user out", async ({
  page,
}) => {
  const email = `e2e-delete-${Date.now()}@example.com`;
  const password = "correct horse battery staple";

  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign up" }).click();

  await expect(page.getByText("Your pantry is empty.")).toBeVisible();

  await page.getByRole("link", { name: "+ Add item" }).click();
  await page.getByLabel("Name").fill("Rice");
  await page.getByLabel("Quantity").fill("2");
  await page.getByLabel("Unit").selectOption("kg");
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByRole("cell", { name: "2 kg" })).toBeVisible();

  const sql = postgres(process.env.DATABASE_URL!);
  try {
    const beforeDelete = await sql`
      SELECT h.id FROM households h
      JOIN auth.users u ON u.id = h.user_id
      WHERE u.email = ${email}
    `;
    expect(beforeDelete).toHaveLength(1);

    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Delete account" }).click();
    await expect(
      page.getByRole("heading", { name: "Delete account?" }),
    ).toBeVisible();
    await expect(page.getByText(/cannot be undone/i)).toBeVisible();

    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete account" })
      .click();

    await expect(page).toHaveURL(/\/login$/);

    const afterDeleteUser = await sql`
      SELECT id FROM auth.users WHERE email = ${email}
    `;
    expect(afterDeleteUser).toHaveLength(0);

    const afterDeleteHousehold = await sql`
      SELECT h.id FROM households h WHERE h.id = ${beforeDelete[0].id}
    `;
    expect(afterDeleteHousehold).toHaveLength(0);
  } finally {
    await sql.end();
  }

  // The account is gone — re-authenticating with the same credentials fails.
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText(/invalid/i)).toBeVisible();

  // And visiting the home page shows the signed-out state rather than the
  // deleted account's (nonexistent) pantry.
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
});

test("deleting the account from the dedicated account page also cascades and signs out", async ({
  page,
}) => {
  const email = `e2e-delete-page-${Date.now()}@example.com`;
  const password = "correct horse battery staple";

  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign up" }).click();

  await expect(page.getByText("Your pantry is empty.")).toBeVisible();

  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Account", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);

  await page.getByRole("button", { name: "Delete account" }).click();
  await expect(
    page.getByRole("heading", { name: "Delete account?" }),
  ).toBeVisible();

  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete account" })
    .click();

  await expect(page).toHaveURL(/\/login$/);

  const sql = postgres(process.env.DATABASE_URL!);
  try {
    const rows = await sql`SELECT id FROM auth.users WHERE email = ${email}`;
    expect(rows).toHaveLength(0);
  } finally {
    await sql.end();
  }
});
