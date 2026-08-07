import { expect, Page, test } from "@playwright/test";

// The increment/decrement buttons (PER-231) update the displayed quantity
// optimistically, before the underlying server action's request completes —
// so clicking one no longer doubles as a sync barrier the way it used to.
// Steps that depend on confirmed server state (e.g. a fresh page load)
// must wait for the action's own response instead of the (now decoupled)
// display update.
async function clickAndAwaitAction(page: Page, name: string) {
  const responsePromise = page.waitForResponse(
    (response) => response.request().method() === "POST",
  );
  await page.getByRole("button", { name }).click();
  await responsePromise;
}

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
  await page.getByLabel("Quantity", { exact: true }).fill("2");
  await page.getByLabel("Unit").selectOption("kg");
  await page.getByRole("button", { name: "Add item" }).click();

  await expect(page.getByText("Rice")).toBeVisible();
  await expect(page.getByRole("cell", { name: "2 kg" })).toBeVisible();

  // Adding under a different-case name increments the existing row rather
  // than creating a second one.
  await page.getByRole("link", { name: "+ Add item" }).click();
  await page.getByLabel("Name").fill("rice");
  await page.getByLabel("Quantity", { exact: true }).fill("1");
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
  await expect(page.getByLabel("Quantity", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Unit")).toBeVisible();

  await page.getByLabel("Name").fill("Rice");
  await page.getByLabel("Quantity", { exact: true }).fill("2");
  await page.getByLabel("Unit").selectOption("kg");
  await page.getByRole("button", { name: "Add item" }).click();

  // The horizontal-scroll fallback (ADR 0004) means the row stays reachable
  // even though the table is wider than the 375px viewport.
  await expect(page.getByText("Rice")).toBeVisible();
  await expect(page.getByRole("cell", { name: "2 kg" })).toBeVisible();

  // Crossing zero (PER-236) must not shift the row's height at this
  // stacked/narrow breakpoint either — the out-of-stock label is
  // screen-reader-only rather than a second visible line under the name.
  const rowBefore = await page.getByRole("row", { name: /Rice/ }).boundingBox();
  await clickAndAwaitAction(page, "Decrease Rice quantity");
  await clickAndAwaitAction(page, "Decrease Rice quantity");
  await expect(page.getByRole("cell", { name: "0 kg" })).toBeVisible();
  const rowAfter = await page.getByRole("row", { name: /Rice/ }).boundingBox();
  expect(rowAfter?.height).toBe(rowBefore?.height);
});

test("signed-in user can adjust, edit, and delete a pantry item", async ({
  page,
}) => {
  const email = `e2e-items-crud-${Date.now()}@example.com`;
  const password = "correct horse battery staple";

  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign up" }).click();

  await page.getByRole("link", { name: "+ Add item" }).click();
  await page.getByLabel("Name").fill("Rice");
  await page.getByLabel("Quantity", { exact: true }).fill("2");
  await page.getByLabel("Unit").selectOption("kg");
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByRole("cell", { name: "2 kg" })).toBeVisible();

  // Increment/decrement icon buttons adjust quantity without opening a form.
  await clickAndAwaitAction(page, "Increase Rice quantity");
  await expect(page.getByRole("cell", { name: "3 kg" })).toBeVisible();

  // Crossing zero (PER-236) must not shift layout: capture the row height and
  // Name column width beforehand so we can assert they're unchanged after.
  const rowBefore = await page.getByRole("row", { name: /Rice/ }).boundingBox();
  const nameColumnBefore = await page
    .getByRole("columnheader", { name: "Name" })
    .boundingBox();

  await clickAndAwaitAction(page, "Decrease Rice quantity");
  await clickAndAwaitAction(page, "Decrease Rice quantity");
  await clickAndAwaitAction(page, "Decrease Rice quantity");
  await expect(page.getByRole("cell", { name: "0 kg" })).toBeVisible();
  // The label is screen-reader-only (no visible text mount/unmount, to avoid
  // layout shift): attached to the DOM, but Tailwind's sr-only clips it to a
  // 1x1px box, so it takes up no visible space. (Playwright's toBeVisible()
  // only checks for a non-empty box and would report a false positive here,
  // since 1x1px isn't empty — hence asserting the box size directly.) The
  // row's red tint is the sighted-user signal instead.
  const outOfStockLabel = page.getByText("Out of stock");
  await expect(outOfStockLabel).toBeAttached();
  const labelBox = await outOfStockLabel.boundingBox();
  expect(labelBox?.width).toBeLessThanOrEqual(1);
  expect(labelBox?.height).toBeLessThanOrEqual(1);
  await expect(page.getByRole("row", { name: /Rice/ })).toHaveClass(
    /bg-red-100/,
  );

  const rowAfter = await page.getByRole("row", { name: /Rice/ }).boundingBox();
  const nameColumnAfter = await page
    .getByRole("columnheader", { name: "Name" })
    .boundingBox();
  expect(rowAfter?.height).toBe(rowBefore?.height);
  expect(nameColumnAfter?.width).toBe(nameColumnBefore?.width);

  // Decrementing further is blocked — the quantity never goes negative, and
  // the control disables itself once there's nothing left to decrement.
  await expect(
    page.getByRole("button", { name: "Decrease Rice quantity" }),
  ).toBeDisabled();

  // Editing opens the same focused form, prefilled, and saving updates the item.
  await page.getByRole("link", { name: "Edit Rice" }).click();
  await expect(page.getByLabel("Name")).toHaveValue("Rice");
  await expect(page.getByLabel("Quantity", { exact: true })).toHaveValue("0");
  await expect(page.getByLabel("Unit")).toHaveValue("kg");

  await page.getByLabel("Name").fill("Basmati rice");
  await page.getByLabel("Quantity", { exact: true }).fill("4");
  await page.getByLabel("Unit").selectOption("g");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByText("Basmati rice")).toBeVisible();
  await expect(page.getByRole("cell", { name: "4 g" })).toBeVisible();

  // Deleting removes the item entirely.
  await page.getByRole("button", { name: "Delete Basmati rice" }).click();
  await expect(page.getByText("Your pantry is empty.")).toBeVisible();
});
