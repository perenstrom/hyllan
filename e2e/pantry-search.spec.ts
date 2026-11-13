import { expect, Page, test } from "@playwright/test";

// Search on the pantry list (PER-400). The matching and filter rules are
// covered by signed-in-home.test.tsx; these cover what only a real browser
// and router can: the `?q=` round trip through history, the Add link's
// pre-filled name, and which placement shows at which width.

async function signUpWithItems(page: Page, prefix: string, names: string[]) {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(`${prefix}-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("correct horse battery staple");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByText("Your pantry is empty.")).toBeVisible();

  for (const name of names) {
    await page.getByRole("link", { name: "+ Add item" }).click();
    await page.getByLabel("Name").fill(name);
    await page.getByRole("button", { name: "Add item" }).click();
    await expect(page.getByRole("cell", { name, exact: true })).toBeVisible();
  }
}

function searchBox(page: Page) {
  return page.getByRole("searchbox", { name: "Search pantry items" });
}

test("a search survives editing an item and going back, and its Add link pre-fills the name", async ({
  page,
}) => {
  await signUpWithItems(page, "e2e-search", ["Krossade tomater", "Mjölk"]);

  // `/` opens the desktop placement, inline in the toolbar row.
  await page.keyboard.press("/");
  await expect(searchBox(page)).toBeFocused();
  await page.keyboard.type("tom kross");
  await expect(page).toHaveURL(/\?q=tom\+kross$/);
  await expect(
    page.getByRole("cell", { name: "Mjölk", exact: true }),
  ).toBeHidden();

  await page
    .getByRole("button", { name: "Actions for Krossade tomater" })
    .click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await expect(page.getByRole("heading", { name: "Edit item" })).toBeVisible();
  await page.goBack();

  await expect(searchBox(page)).toHaveValue("tom kross");
  await expect(
    page.getByRole("cell", { name: "Krossade tomater", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Mjölk", exact: true }),
  ).toBeHidden();

  await searchBox(page).fill("Fusilli");
  await expect(page.getByText("No items match “Fusilli”.")).toBeVisible();
  await page.getByRole("link", { name: "+ Add “Fusilli”" }).click();
  await expect(page.getByLabel("Name")).toHaveValue("Fusilli");

  // A fresh visit starts with no query.
  await page.goto("/");
  await expect(searchBox(page)).toHaveCount(0);
  await expect(
    page.getByRole("cell", { name: "Mjölk", exact: true }),
  ).toBeVisible();
});

test("on a phone, the search replaces the title and leaves the toolbar row alone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await signUpWithItems(page, "e2e-search-mobile", ["Rice", "Coffee"]);

  const title = page.getByRole("heading", { name: "Your pantry" });
  await page
    .getByRole("button", { name: "Search pantry items" })
    .and(page.locator(":visible"))
    .click();
  await expect(title).toBeHidden();
  await expect(searchBox(page).and(page.locator(":visible"))).toBeFocused();
  await page.keyboard.type("ric");

  await expect(
    page.getByRole("cell", { name: "Coffee", exact: true }),
  ).toBeHidden();
  await expect(page.getByRole("button", { name: "By location" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Status/ })).toBeVisible();
  const pageWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(pageWidth).toBeLessThanOrEqual(375);

  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(title).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Coffee", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});
