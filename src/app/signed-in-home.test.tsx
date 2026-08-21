import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PantryItemBucket } from "@/lib/location";
import type { PantryItemWithLocations } from "@/lib/pantry-items";

const decrementItemMock = vi.fn();
const incrementItemMock = vi.fn();
const deleteItemMock = vi.fn();

// signed-in-home.tsx binds these server actions directly to form actions
// (Next's documented pattern for passing extra args), so importing it pulls
// in "@/db/client" transitively — mock the actions module the same way
// add-item-form.test.tsx mocks "../actions" to avoid needing DATABASE_URL.
vi.mock("./items/actions", () => ({
  decrementItem: (...args: unknown[]) => decrementItemMock(...args),
  incrementItem: (...args: unknown[]) => incrementItemMock(...args),
  deleteItem: (...args: unknown[]) => deleteItemMock(...args),
}));

// The header's account menu binds these the same way — deleteAccount pulls
// in "@/db/client" transitively too, so it needs the same treatment.
vi.mock("./actions", () => ({
  signOut: vi.fn(),
  deleteAccount: vi.fn(),
}));

const { SignedInHome } = await import("./signed-in-home");

const PANTRY_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const GARAGE_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

// Single-bucket items (the common case, and the only shape most of these
// tests need) get one implicit unassigned bucket holding the full
// quantity — everything renders identically to the pre-location table.
function itemRow(
  overrides: Partial<
    Omit<PantryItemWithLocations, "buckets"> & { buckets: PantryItemBucket[] }
  > = {},
): PantryItemWithLocations {
  const quantity = overrides.quantity ?? "2";
  const buckets = overrides.buckets ?? [
    { locationId: null, locationName: null, quantity },
  ];
  return {
    id: "11111111-1111-1111-1111-111111111111",
    householdId: "22222222-2222-2222-2222-222222222222",
    name: "Rice",
    unit: "kg",
    minimumQuantity: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
    quantity,
    buckets,
  };
}

function renderHome(
  props: Partial<Parameters<typeof SignedInHome>[0]> & {
    items: PantryItemWithLocations[];
  },
) {
  return render(<SignedInHome locations={[]} {...props} />);
}

function nameCells() {
  return screen
    .getAllByRole("row")
    .slice(1) // drop the header row
    .map((row) => row.querySelector("td")?.textContent);
}

describe("SignedInHome", () => {
  beforeEach(() => {
    decrementItemMock.mockReset();
    incrementItemMock.mockReset();
    deleteItemMock.mockReset();
    window.localStorage.clear();
  });

  it("shows the empty state when there are no items", () => {
    renderHome({ items: [] });

    expect(screen.getByText("Your pantry is empty.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders a row per item with the unit postfixed onto the amount", () => {
    renderHome({ items: [itemRow()] });

    expect(screen.getByRole("cell", { name: "Rice" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "2 kg" })).toBeInTheDocument();
  });

  it("omits the unit for the unit-less count default", () => {
    renderHome({
      items: [itemRow({ name: "Eggs", quantity: "6", unit: "count" })],
    });

    expect(screen.getByRole("cell", { name: "6" })).toBeInTheDocument();
  });

  it("keeps a zero-quantity item visible, with a screen-reader-only out-of-stock label", () => {
    renderHome({ items: [itemRow({ quantity: "0" })] });

    expect(screen.getByText("Rice")).toBeInTheDocument();
    expect(screen.getByText("Out of stock")).toHaveClass("sr-only");
  });

  it("tints an out-of-stock row's background instead of showing a visible label", () => {
    renderHome({ items: [itemRow({ quantity: "0" })] });

    const row = screen.getByText("Rice").closest("tr");
    expect(row).toHaveClass("bg-red-100", "dark:bg-red-950");
  });

  it("does not label or tint an in-stock item as out of stock", () => {
    renderHome({ items: [itemRow()] });

    expect(screen.queryByText("Out of stock")).not.toBeInTheDocument();
    const row = screen.getByText("Rice").closest("tr");
    expect(row).not.toHaveClass("bg-red-100");
  });

  it("tints a low-stock row amber with a screen-reader-only label, when quantity is at or below its minimum", () => {
    renderHome({
      items: [itemRow({ quantity: "1", minimumQuantity: "2" })],
    });

    expect(screen.getByText("Low stock")).toHaveClass("sr-only");
    const row = screen.getByText("Rice").closest("tr");
    expect(row).toHaveClass("bg-amber-100", "dark:bg-amber-950");
  });

  it("treats out of stock (quantity zero) as taking precedence over low stock, never both", () => {
    renderHome({
      items: [itemRow({ quantity: "0", minimumQuantity: "2" })],
    });

    expect(screen.getByText("Out of stock")).toHaveClass("sr-only");
    expect(screen.queryByText("Low stock")).not.toBeInTheDocument();
    const row = screen.getByText("Rice").closest("tr");
    expect(row).toHaveClass("bg-red-100");
    expect(row).not.toHaveClass("bg-amber-100");
  });

  it("never treats an item with no minimum quantity set as low stock", () => {
    renderHome({
      items: [itemRow({ quantity: "1", minimumQuantity: null })],
    });

    expect(screen.queryByText("Low stock")).not.toBeInTheDocument();
  });

  it("removes the content container's horizontal padding below sm so the table can sit flush, restoring it at/above sm", () => {
    renderHome({ items: [] });

    const main = screen.getByRole("main");
    expect(main).not.toHaveClass("px-2");
    expect(main).toHaveClass("py-5", "sm:px-6", "sm:py-6");
  });

  it("keeps a small horizontal inset on the header row below sm, since main no longer provides one there", () => {
    renderHome({ items: [] });

    const header = screen.getByText("Your pantry").closest("div");
    expect(header).toHaveClass("px-2", "sm:px-0");
  });

  it("shrinks table cell horizontal padding below sm, restoring it at/above sm", () => {
    renderHome({ items: [itemRow()] });

    const cells = [
      ...screen.getAllByRole("columnheader"),
      ...screen.getAllByRole("cell"),
    ];
    for (const cell of cells) {
      expect(cell).not.toHaveClass("px-4");
      expect(cell).toHaveClass("px-2", "py-2", "sm:px-4");
    }
  });

  it("drops the table wrapper's border and rounded corners below sm, restoring them at/above sm", () => {
    renderHome({ items: [itemRow()] });

    const wrapper = screen.getByRole("table").parentElement as HTMLElement;
    expect(wrapper).not.toHaveClass("border", "rounded-lg");
    expect(wrapper).toHaveClass(
      "sm:rounded-lg",
      "sm:border",
      "sm:border-zinc-200",
      "dark:sm:border-zinc-800",
    );
  });

  it("links the add-item action to the focused form", () => {
    renderHome({ items: [] });

    expect(screen.getByRole("link", { name: "+ Add item" })).toHaveAttribute(
      "href",
      "/items/new",
    );
  });

  it("renders increment/decrement controls and an overflow menu trigger per item", () => {
    renderHome({ items: [itemRow()] });

    expect(
      screen.getByRole("button", { name: "Increase Rice quantity" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Decrease Rice quantity" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Actions for Rice" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Edit Rice" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Edit" }),
    ).not.toBeInTheDocument();
  });

  function getActionsContainer() {
    const decrementForm = screen
      .getByRole("button", { name: "Decrease Rice quantity" })
      .closest("form");
    return decrementForm?.parentElement as HTMLElement;
  }

  it("lays the actions out as a single row at every viewport (ADR 0004, PER-266)", () => {
    renderHome({ items: [itemRow()] });

    const container = getActionsContainer();
    expect(container).toHaveClass("flex", "items-center", "gap-1.5");
    expect(container).not.toHaveClass("grid", "grid-cols-2");
  });

  it("orders the actions decrement, increment, overflow trigger", () => {
    renderHome({ items: [itemRow()] });

    // Scoped to aria-labeled controls only: RowActionsMenu also renders its
    // (closed) DeleteItemDialog inline in this same container, and its
    // Cancel/Delete buttons carry visible text instead of aria-label, so
    // they fall outside what this test is asserting the order of.
    const controls = Array.from(
      getActionsContainer().querySelectorAll(
        "button[aria-label], a[aria-label]",
      ),
    );

    expect(controls.map((el) => el.getAttribute("aria-label"))).toEqual([
      "Decrease Rice quantity",
      "Increase Rice quantity",
      "Actions for Rice",
    ]);
  });

  it("opens the overflow menu with plain-text Edit and Delete menu items", async () => {
    const user = userEvent.setup();
    renderHome({ items: [itemRow()] });

    expect(
      screen.queryByRole("menuitem", { name: "Edit" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Actions for Rice" }));

    expect(screen.getByRole("menuitem", { name: "Edit" })).toHaveAttribute(
      "href",
      "/items/11111111-1111-1111-1111-111111111111/edit",
    );
    expect(
      screen.getByRole("menuitem", { name: "Delete" }),
    ).toBeInTheDocument();
  });

  it("closes the overflow menu once Edit is selected", async () => {
    const user = userEvent.setup();
    renderHome({ items: [itemRow()] });

    await user.click(screen.getByRole("button", { name: "Actions for Rice" }));
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));

    expect(
      screen.queryByRole("menuitem", { name: "Delete" }),
    ).not.toBeInTheDocument();
  });

  it("opens a confirmation dialog on selecting Delete instead of deleting immediately", async () => {
    const user = userEvent.setup();
    renderHome({ items: [itemRow()] });

    await user.click(screen.getByRole("button", { name: "Actions for Rice" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(deleteItemMock).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("menuitem", { name: "Delete" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Delete Rice?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "This immediately and permanently deletes this pantry item. This cannot be undone.",
      ),
    ).toBeInTheDocument();
  });

  it("closes the delete confirmation dialog without deleting anything when canceled", async () => {
    const user = userEvent.setup();
    renderHome({ items: [itemRow()] });

    await user.click(screen.getByRole("button", { name: "Actions for Rice" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(deleteItemMock).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("heading", { name: "Delete Rice?" }),
    ).not.toBeInTheDocument();
  });

  it("deletes the item once the confirmation dialog's Delete button is confirmed", async () => {
    const user = userEvent.setup();
    renderHome({ items: [itemRow()] });

    await user.click(screen.getByRole("button", { name: "Actions for Rice" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(deleteItemMock).toHaveBeenCalledExactlyOnceWith(
      "11111111-1111-1111-1111-111111111111",
    );
  });

  it("closes the overflow menu on outside click", async () => {
    const user = userEvent.setup();
    renderHome({ items: [itemRow()] });

    await user.click(screen.getByRole("button", { name: "Actions for Rice" }));
    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();

    // Radix's modal dropdown disables pointer events on the rest of the
    // page while open, so a real click can't land on another element the
    // way it would once the menu is closed — fire the raw pointerdown its
    // outside-dismiss listener reacts to instead.
    fireEvent.pointerDown(document.body);

    expect(
      screen.queryByRole("menuitem", { name: "Edit" }),
    ).not.toBeInTheDocument();
  });

  it("supports arrow-key navigation between the overflow menu's items", async () => {
    const user = userEvent.setup();
    renderHome({ items: [itemRow()] });

    await user.click(screen.getByRole("button", { name: "Actions for Rice" }));
    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("menuitem", { name: "Edit" })).toHaveFocus();

    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveFocus();
  });

  it("closes the overflow menu on Escape", async () => {
    const user = userEvent.setup();
    renderHome({ items: [itemRow()] });

    await user.click(screen.getByRole("button", { name: "Actions for Rice" }));
    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(
      screen.queryByRole("menuitem", { name: "Edit" }),
    ).not.toBeInTheDocument();
  });

  it("disables the decrement control once an item is out of stock", () => {
    renderHome({ items: [itemRow({ quantity: "0" })] });

    expect(
      screen.getByRole("button", { name: "Decrease Rice quantity" }),
    ).toBeDisabled();
  });

  it("shows the incremented amount immediately, before the server action resolves", async () => {
    let resolveIncrement: () => void = () => {};
    incrementItemMock.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveIncrement = resolve;
      }),
    );

    renderHome({ items: [itemRow({ quantity: "2" })] });
    fireEvent.click(
      screen.getByRole("button", { name: "Increase Rice quantity" }),
    );

    expect(
      await screen.findByRole("cell", { name: "3 kg" }),
    ).toBeInTheDocument();
    expect(incrementItemMock).toHaveBeenCalledExactlyOnceWith(
      "11111111-1111-1111-1111-111111111111",
      null,
    );

    resolveIncrement();
  });

  it("shows the decremented amount immediately, before the server action resolves", async () => {
    let resolveDecrement: () => void = () => {};
    decrementItemMock.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDecrement = resolve;
      }),
    );

    renderHome({ items: [itemRow({ quantity: "2" })] });
    fireEvent.click(
      screen.getByRole("button", { name: "Decrease Rice quantity" }),
    );

    expect(
      await screen.findByRole("cell", { name: "1 kg" }),
    ).toBeInTheDocument();
    expect(decrementItemMock).toHaveBeenCalledExactlyOnceWith(
      "11111111-1111-1111-1111-111111111111",
      null,
    );

    resolveDecrement();
  });

  it("optimistically floors the decrement at zero, mirroring the server's clamp", async () => {
    let resolveDecrement: () => void = () => {};
    decrementItemMock.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDecrement = resolve;
      }),
    );

    renderHome({ items: [itemRow({ quantity: "0.5" })] });
    fireEvent.click(
      screen.getByRole("button", { name: "Decrease Rice quantity" }),
    );

    expect(await screen.findByText("Out of stock")).toHaveClass("sr-only");

    resolveDecrement();
  });

  function sortItems() {
    return [
      itemRow({
        id: "11111111-1111-1111-1111-111111111111",
        name: "Banana",
        quantity: "5",
        unit: "count",
      }),
      itemRow({
        id: "22222222-2222-2222-2222-222222222222",
        name: "apple",
        quantity: "10",
        unit: "count",
      }),
      itemRow({
        id: "33333333-3333-3333-3333-333333333333",
        name: "Cherry",
        quantity: "1",
        unit: "count",
      }),
    ];
  }

  function nameHeader() {
    return screen.getByRole("columnheader", { name: "Name" });
  }

  function amountHeader() {
    return screen.getByRole("columnheader", { name: "Amount" });
  }

  describe("column-header sorting (PER-249)", () => {
    it("renders rows in the incoming (default createdAt) order with aria-sort none on both headers", () => {
      renderHome({ items: sortItems() });

      expect(nameCells()).toEqual(["Banana", "apple", "Cherry"]);
      expect(nameHeader()).toHaveAttribute("aria-sort", "none");
      expect(amountHeader()).toHaveAttribute("aria-sort", "none");
    });

    it("sorts by name ascending on first click, case-insensitively", () => {
      renderHome({ items: sortItems() });

      fireEvent.click(within(nameHeader()).getByRole("button"));

      expect(nameCells()).toEqual(["apple", "Banana", "Cherry"]);
      expect(nameHeader()).toHaveAttribute("aria-sort", "ascending");
    });

    it("cycles name ascending -> descending -> default on repeated clicks", () => {
      renderHome({ items: sortItems() });
      const button = within(nameHeader()).getByRole("button");

      fireEvent.click(button);
      fireEvent.click(button);
      expect(nameCells()).toEqual(["Cherry", "Banana", "apple"]);
      expect(nameHeader()).toHaveAttribute("aria-sort", "descending");

      fireEvent.click(button);
      expect(nameCells()).toEqual(["Banana", "apple", "Cherry"]);
      expect(nameHeader()).toHaveAttribute("aria-sort", "none");
    });

    it("sorts by amount ascending on the raw numeric quantity", () => {
      renderHome({ items: sortItems() });

      fireEvent.click(within(amountHeader()).getByRole("button"));

      expect(nameCells()).toEqual(["Cherry", "Banana", "apple"]);
      expect(amountHeader()).toHaveAttribute("aria-sort", "ascending");
    });

    it("switching to a different column always restarts at ascending", () => {
      renderHome({ items: sortItems() });

      const nameButton = within(nameHeader()).getByRole("button");
      fireEvent.click(nameButton);
      fireEvent.click(nameButton); // now descending on name

      fireEvent.click(within(amountHeader()).getByRole("button"));

      expect(amountHeader()).toHaveAttribute("aria-sort", "ascending");
      expect(nameHeader()).toHaveAttribute("aria-sort", "none");
      expect(nameCells()).toEqual(["Cherry", "Banana", "apple"]);
    });

    it("does not make the Actions header sortable", () => {
      renderHome({ items: sortItems() });

      const actionsHeader = screen.getByRole("columnheader", {
        name: "Actions",
      });
      expect(
        within(actionsHeader).queryByRole("button"),
      ).not.toBeInTheDocument();
      expect(actionsHeader).not.toHaveAttribute("aria-sort");
    });

    it("persists sort state to localStorage and restores it on the next render", () => {
      const { unmount } = renderHome({ items: sortItems() });
      fireEvent.click(within(amountHeader()).getByRole("button"));
      unmount();

      renderHome({ items: sortItems() });

      expect(nameCells()).toEqual(["Cherry", "Banana", "apple"]);
      expect(amountHeader()).toHaveAttribute("aria-sort", "ascending");
    });

    it("does not live-reorder rows while an optimistic quantity update is in flight", async () => {
      let resolveIncrement: () => void = () => {};
      incrementItemMock.mockReturnValue(
        new Promise<void>((resolve) => {
          resolveIncrement = resolve;
        }),
      );

      renderHome({ items: sortItems() });
      fireEvent.click(within(amountHeader()).getByRole("button"));
      expect(nameCells()).toEqual(["Cherry", "Banana", "apple"]);

      // Incrementing apple (quantity 10 -> 11) would, if re-sorted live,
      // still land last by amount — increment Cherry (1 -> 2) instead,
      // which would jump ahead of Banana (5) under a live re-sort.
      fireEvent.click(
        screen.getByRole("button", { name: "Increase Cherry quantity" }),
      );

      expect(
        await screen.findByRole("cell", { name: "2" }),
      ).toBeInTheDocument();
      expect(nameCells()).toEqual(["Cherry", "Banana", "apple"]);

      resolveIncrement();
    });
  });

  describe("status filter (PER-251)", () => {
    function statusItems() {
      return [
        itemRow({
          id: "11111111-1111-1111-1111-111111111111",
          name: "In stock item",
          quantity: "5",
          minimumQuantity: null,
        }),
        itemRow({
          id: "22222222-2222-2222-2222-222222222222",
          name: "Low stock item",
          quantity: "1",
          minimumQuantity: "2",
        }),
        itemRow({
          id: "33333333-3333-3333-3333-333333333333",
          name: "Out of stock item",
          quantity: "0",
          minimumQuantity: null,
        }),
      ];
    }

    function openStatusDropdown() {
      fireEvent.click(screen.getByRole("button", { name: /^Status/ }));
    }

    it("does not render the dropdown when the pantry is empty", () => {
      renderHome({ items: [] });

      expect(
        screen.queryByRole("button", { name: /^Status/ }),
      ).not.toBeInTheDocument();
    });

    it("shows every item by default, with all three boxes checked", () => {
      renderHome({ items: statusItems() });
      openStatusDropdown();

      expect(screen.getByRole("checkbox", { name: "In stock" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Low stock" })).toBeChecked();
      expect(
        screen.getByRole("checkbox", { name: "Out of stock" }),
      ).toBeChecked();
      expect(screen.getByText("In stock item")).toBeInTheDocument();
      expect(screen.getByText("Low stock item")).toBeInTheDocument();
      expect(screen.getByText("Out of stock item")).toBeInTheDocument();
    });

    it("hides rows whose status is unchecked and shows the trigger's active count", () => {
      renderHome({ items: statusItems() });
      openStatusDropdown();

      fireEvent.click(screen.getByRole("checkbox", { name: "Low stock" }));

      expect(screen.queryByText("Low stock item")).not.toBeInTheDocument();
      expect(screen.getByText("In stock item")).toBeInTheDocument();
      expect(screen.getByText("Out of stock item")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Status (2/3)" }),
      ).toBeInTheDocument();
    });

    it("shows the empty-state message when every box is unchecked, without blocking the action", () => {
      renderHome({ items: statusItems() });
      openStatusDropdown();

      fireEvent.click(screen.getByRole("checkbox", { name: "In stock" }));
      fireEvent.click(screen.getByRole("checkbox", { name: "Low stock" }));
      fireEvent.click(screen.getByRole("checkbox", { name: "Out of stock" }));

      expect(
        screen.getByText("No items match the current filter."),
      ).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("persists the filter to localStorage and restores it on the next render", () => {
      const { unmount } = renderHome({ items: statusItems() });
      openStatusDropdown();
      fireEvent.click(screen.getByRole("checkbox", { name: "Low stock" }));
      unmount();

      renderHome({ items: statusItems() });

      expect(screen.queryByText("Low stock item")).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Status (2/3)" }),
      ).toBeInTheDocument();
    });

    it("hides a row the instant an optimistic update moves it out of the active filter", async () => {
      let resolveDecrement: () => void = () => {};
      decrementItemMock.mockReturnValue(
        new Promise<void>((resolve) => {
          resolveDecrement = resolve;
        }),
      );

      renderHome({ items: statusItems() });
      openStatusDropdown();
      fireEvent.click(screen.getByRole("checkbox", { name: "Out of stock" }));
      expect(screen.getByText("In stock item")).toBeInTheDocument();

      fireEvent.click(
        screen.getByRole("button", { name: "Decrease In stock item quantity" }),
      );
      for (let i = 0; i < 4; i++) {
        fireEvent.click(
          screen.getByRole("button", {
            name: "Decrease In stock item quantity",
          }),
        );
      }

      expect(screen.queryByText("In stock item")).not.toBeInTheDocument();

      resolveDecrement();
    });
  });

  describe("multi-location row expansion (PER-288)", () => {
    function multiLocationItem() {
      return itemRow({
        name: "Rice",
        quantity: "8",
        buckets: [
          { locationId: PANTRY_ID, locationName: "Pantry", quantity: "5" },
          { locationId: null, locationName: null, quantity: "3" },
        ],
      });
    }

    it("shows a chevron and starts expanded for a multi-location item", () => {
      renderHome({ items: [multiLocationItem()] });

      expect(
        screen.getByRole("button", { name: "Collapse Rice locations" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Pantry")).toBeInTheDocument();
      expect(screen.getByText("Unassigned")).toBeInTheDocument();
    });

    it("shows the true total on the top-level row regardless of expansion", () => {
      renderHome({ items: [multiLocationItem()] });

      expect(screen.getByRole("cell", { name: "8 kg" })).toBeInTheDocument();
    });

    it("does not show a chevron for a single-bucket item", () => {
      renderHome({ items: [itemRow()] });

      expect(
        screen.queryByRole("button", { name: /locations$/ }),
      ).not.toBeInTheDocument();
    });

    it("collapses and re-expands via the chevron", async () => {
      const user = userEvent.setup();
      renderHome({ items: [multiLocationItem()] });

      await user.click(
        screen.getByRole("button", { name: "Collapse Rice locations" }),
      );
      expect(screen.queryByText("Pantry")).not.toBeInTheDocument();

      await user.click(
        screen.getByRole("button", { name: "Expand Rice locations" }),
      );
      expect(screen.getByText("Pantry")).toBeInTheDocument();
    });

    it("gives each sub-row its own direct +/- targeting that bucket's location", () => {
      renderHome({ items: [multiLocationItem()] });

      expect(
        screen.getByRole("button", {
          name: "Increase Rice quantity at Pantry",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: "Increase Rice quantity at Unassigned",
        }),
      ).toBeInTheDocument();

      fireEvent.click(
        screen.getByRole("button", {
          name: "Increase Rice quantity at Pantry",
        }),
      );

      expect(incrementItemMock).toHaveBeenCalledExactlyOnceWith(
        "11111111-1111-1111-1111-111111111111",
        PANTRY_ID,
      );
    });

    it("shows no direct +/- on the top-level row of a multi-location item", () => {
      renderHome({ items: [multiLocationItem()] });

      expect(
        screen.queryByRole("button", { name: "Increase Rice quantity" }),
      ).not.toBeInTheDocument();
      expect(screen.getByText("Expanded below")).toBeInTheDocument();
    });
  });

  describe("group-by switch (PER-288)", () => {
    function twoLocationItems() {
      return [
        itemRow({
          id: "11111111-1111-1111-1111-111111111111",
          name: "Rice",
          quantity: "5",
          buckets: [
            { locationId: PANTRY_ID, locationName: "Pantry", quantity: "5" },
          ],
        }),
        itemRow({
          id: "22222222-2222-2222-2222-222222222222",
          name: "Coffee",
          quantity: "2",
          buckets: [
            {
              locationId: GARAGE_ID,
              locationName: "Garage fridge",
              quantity: "2",
            },
          ],
        }),
      ];
    }

    it("defaults to By item", () => {
      renderHome({ items: twoLocationItems() });

      expect(screen.getByRole("button", { name: "By item" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });

    it("groups items into one section per location when switched to By location", async () => {
      const user = userEvent.setup();
      renderHome({
        items: twoLocationItems(),
        locations: [
          { id: PANTRY_ID, name: "Pantry" },
          { id: GARAGE_ID, name: "Garage fridge" },
        ],
      });

      await user.click(screen.getByRole("button", { name: "By location" }));

      expect(
        screen.getByRole("heading", { name: "Pantry" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Garage fridge" }),
      ).toBeInTheDocument();
    });

    it("omits empty sections", async () => {
      const user = userEvent.setup();
      renderHome({
        items: [
          itemRow({
            buckets: [
              { locationId: PANTRY_ID, locationName: "Pantry", quantity: "2" },
            ],
          }),
        ],
        locations: [{ id: PANTRY_ID, name: "Pantry" }],
      });

      await user.click(screen.getByRole("button", { name: "By location" }));

      expect(screen.queryByText("Unassigned")).not.toBeInTheDocument();
    });
  });

  describe("location filter (PER-288)", () => {
    const locations = [
      { id: PANTRY_ID, name: "Pantry" },
      { id: GARAGE_ID, name: "Garage fridge" },
    ];

    function openLocationDropdown() {
      fireEvent.click(screen.getByRole("button", { name: /^Locations/ }));
    }

    it("shows every location plus Unassigned, all checked by default", () => {
      renderHome({ items: [itemRow()], locations });
      openLocationDropdown();

      expect(screen.getByRole("checkbox", { name: "Pantry" })).toBeChecked();
      expect(
        screen.getByRole("checkbox", { name: "Garage fridge" }),
      ).toBeChecked();
      expect(
        screen.getByRole("checkbox", { name: "Unassigned" }),
      ).toBeChecked();
    });

    it("hides an item whose quantity sits only in a hidden location", () => {
      renderHome({
        items: [
          itemRow({
            buckets: [
              { locationId: PANTRY_ID, locationName: "Pantry", quantity: "2" },
            ],
          }),
        ],
        locations,
      });
      openLocationDropdown();

      fireEvent.click(screen.getByRole("checkbox", { name: "Pantry" }));

      expect(screen.queryByText("Rice")).not.toBeInTheDocument();
    });

    it("hides only the hidden location's sub-row, keeping a multi-location item visible", () => {
      renderHome({
        items: [
          itemRow({
            quantity: "8",
            buckets: [
              { locationId: PANTRY_ID, locationName: "Pantry", quantity: "5" },
              { locationId: null, locationName: null, quantity: "3" },
            ],
          }),
        ],
        locations,
      });
      openLocationDropdown();

      fireEvent.click(screen.getByRole("checkbox", { name: "Pantry" }));

      // Scoped to the table: the still-open dropdown's own "Pantry"
      // checkbox label would otherwise match too. With only one bucket left
      // visible, the row collapses to the plain single-bucket display (no
      // chevron, no "Unassigned" sub-row label) — same as an item that only
      // ever had the one bucket.
      const table = screen.getByRole("table");
      expect(within(table).getByText("Rice")).toBeInTheDocument();
      expect(within(table).queryByText("Pantry")).not.toBeInTheDocument();
      expect(
        within(table).queryByRole("button", { name: /locations$/ }),
      ).not.toBeInTheDocument();
    });

    it("shows the true total in the Amount column regardless of the filter", () => {
      renderHome({
        items: [
          itemRow({
            quantity: "8",
            buckets: [
              { locationId: PANTRY_ID, locationName: "Pantry", quantity: "5" },
              { locationId: null, locationName: null, quantity: "3" },
            ],
          }),
        ],
        locations,
      });
      openLocationDropdown();

      fireEvent.click(screen.getByRole("checkbox", { name: "Pantry" }));

      expect(screen.getByRole("cell", { name: "8 kg" })).toBeInTheDocument();
    });

    it("links to the manage-locations page", () => {
      renderHome({ items: [itemRow()], locations });
      openLocationDropdown();

      expect(
        screen.getByRole("link", { name: "Manage locations →" }),
      ).toHaveAttribute("href", "/locations");
    });

    it("persists the filter to localStorage and restores it on the next render", () => {
      const { unmount } = renderHome({
        items: [
          itemRow({
            buckets: [
              { locationId: PANTRY_ID, locationName: "Pantry", quantity: "2" },
            ],
          }),
        ],
        locations,
      });
      openLocationDropdown();
      fireEvent.click(screen.getByRole("checkbox", { name: "Pantry" }));
      unmount();

      renderHome({
        items: [
          itemRow({
            buckets: [
              { locationId: PANTRY_ID, locationName: "Pantry", quantity: "2" },
            ],
          }),
        ],
        locations,
      });

      expect(screen.queryByText("Rice")).not.toBeInTheDocument();
    });
  });
});
