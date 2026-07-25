import { expect, test } from "@playwright/test";

test("signed-in user can add a pantry item, and adding a duplicate name increments quantity", async ({
  page,
}) => {
  const email = `e2e-items-${Date.now()}@example.com`;
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

  await expect(page.getByText("Rice")).toBeVisible();
  await expect(page.getByRole("cell", { name: "2 kg" })).toBeVisible();

  // Adding under a different-case name increments the existing row rather
  // than creating a second one.
  await page.getByRole("link", { name: "+ Add item" }).click();
  await page.getByLabel("Name").fill("rice");
  await page.getByLabel("Quantity").fill("1");
  await page.getByLabel("Unit").selectOption("kg");
  await page.getByRole("button", { name: "Add item" }).click();

  await expect(page.getByRole("cell", { name: "3 kg" })).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(2); // header row + one item row
});

test("the pantry table and add-item form stay usable at a mobile width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });

  const email = `e2e-items-mobile-${Date.now()}@example.com`;
  const password = "correct horse battery staple";

  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign up" }).click();

  await page.getByRole("link", { name: "+ Add item" }).click();
  await expect(page.getByLabel("Name")).toBeVisible();
  await expect(page.getByLabel("Quantity")).toBeVisible();
  await expect(page.getByLabel("Unit")).toBeVisible();

  await page.getByLabel("Name").fill("Rice");
  await page.getByLabel("Quantity").fill("2");
  await page.getByLabel("Unit").selectOption("kg");
  await page.getByRole("button", { name: "Add item" }).click();

  // The name/out-of-stock stack and horizontal-scroll fallback (ADR 0004)
  // both mean the row stays reachable even though the table is wider than
  // the 375px viewport.
  await expect(page.getByText("Rice")).toBeVisible();
  await expect(page.getByRole("cell", { name: "2 kg" })).toBeVisible();
});
