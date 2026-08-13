import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

function itemRow(
  overrides: Partial<Parameters<typeof SignedInHome>[0]["items"][number]> = {},
) {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    householdId: "22222222-2222-2222-2222-222222222222",
    name: "Rice",
    quantity: "2",
    unit: "kg" as const,
    minimumQuantity: null as string | null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
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
    render(<SignedInHome items={[]} />);

    expect(screen.getByText("Your pantry is empty.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders a row per item with the unit postfixed onto the amount", () => {
    render(<SignedInHome items={[itemRow()]} />);

    expect(screen.getByRole("cell", { name: "Rice" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "2 kg" })).toBeInTheDocument();
  });

  it("omits the unit for the unit-less count default", () => {
    render(
      <SignedInHome
        items={[itemRow({ name: "Eggs", quantity: "6", unit: "count" })]}
      />,
    );

    expect(screen.getByRole("cell", { name: "6" })).toBeInTheDocument();
  });

  it("keeps a zero-quantity item visible, with a screen-reader-only out-of-stock label", () => {
    render(<SignedInHome items={[itemRow({ quantity: "0" })]} />);

    expect(screen.getByText("Rice")).toBeInTheDocument();
    expect(screen.getByText("Out of stock")).toHaveClass("sr-only");
  });

  it("tints an out-of-stock row's background instead of showing a visible label", () => {
    render(<SignedInHome items={[itemRow({ quantity: "0" })]} />);

    const row = screen.getByText("Rice").closest("tr");
    expect(row).toHaveClass("bg-red-100", "dark:bg-red-950");
  });

  it("does not label or tint an in-stock item as out of stock", () => {
    render(<SignedInHome items={[itemRow()]} />);

    expect(screen.queryByText("Out of stock")).not.toBeInTheDocument();
    const row = screen.getByText("Rice").closest("tr");
    expect(row).not.toHaveClass("bg-red-100");
  });

  it("tints a low-stock row amber with a screen-reader-only label, when quantity is at or below its minimum", () => {
    render(
      <SignedInHome
        items={[itemRow({ quantity: "1", minimumQuantity: "2" })]}
      />,
    );

    expect(screen.getByText("Low stock")).toHaveClass("sr-only");
    const row = screen.getByText("Rice").closest("tr");
    expect(row).toHaveClass("bg-amber-100", "dark:bg-amber-950");
  });

  it("treats out of stock (quantity zero) as taking precedence over low stock, never both", () => {
    render(
      <SignedInHome
        items={[itemRow({ quantity: "0", minimumQuantity: "2" })]}
      />,
    );

    expect(screen.getByText("Out of stock")).toHaveClass("sr-only");
    expect(screen.queryByText("Low stock")).not.toBeInTheDocument();
    const row = screen.getByText("Rice").closest("tr");
    expect(row).toHaveClass("bg-red-100");
    expect(row).not.toHaveClass("bg-amber-100");
  });

  it("never treats an item with no minimum quantity set as low stock", () => {
    render(
      <SignedInHome
        items={[itemRow({ quantity: "1", minimumQuantity: null })]}
      />,
    );

    expect(screen.queryByText("Low stock")).not.toBeInTheDocument();
  });

  it("removes the content container's horizontal padding below sm so the table can sit flush, restoring it at/above sm", () => {
    render(<SignedInHome items={[]} />);

    const main = screen.getByRole("main");
    expect(main).not.toHaveClass("px-2");
    expect(main).toHaveClass("py-5", "sm:px-6", "sm:py-6");
  });

  it("keeps a small horizontal inset on the header row below sm, since main no longer provides one there", () => {
    render(<SignedInHome items={[]} />);

    const header = screen.getByText("Your pantry").closest("div");
    expect(header).toHaveClass("px-2", "sm:px-0");
  });

  it("shrinks table cell horizontal padding below sm, restoring it at/above sm", () => {
    render(<SignedInHome items={[itemRow()]} />);

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
    render(<SignedInHome items={[itemRow()]} />);

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
    render(<SignedInHome items={[]} />);

    expect(screen.getByRole("link", { name: "+ Add item" })).toHaveAttribute(
      "href",
      "/items/new",
    );
  });

  it("renders increment/decrement controls and an overflow menu trigger per item", () => {
    render(<SignedInHome items={[itemRow()]} />);

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
    render(<SignedInHome items={[itemRow()]} />);

    const container = getActionsContainer();
    expect(container).toHaveClass("flex", "items-center", "gap-1.5");
    expect(container).not.toHaveClass("grid", "grid-cols-2");
  });

  it("orders the actions decrement, increment, overflow trigger", () => {
    render(<SignedInHome items={[itemRow()]} />);

    const controls = Array.from(
      getActionsContainer().querySelectorAll("button, a"),
    );

    expect(controls.map((el) => el.getAttribute("aria-label"))).toEqual([
      "Decrease Rice quantity",
      "Increase Rice quantity",
      "Actions for Rice",
    ]);
  });

  it("opens the overflow menu with plain-text Edit and Delete menu items", () => {
    render(<SignedInHome items={[itemRow()]} />);

    expect(
      screen.queryByRole("menuitem", { name: "Edit" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Actions for Rice" }));

    expect(screen.getByRole("menuitem", { name: "Edit" })).toHaveAttribute(
      "href",
      "/items/11111111-1111-1111-1111-111111111111/edit",
    );
    expect(
      screen.getByRole("menuitem", { name: "Delete" }),
    ).toBeInTheDocument();
  });

  it("closes the overflow menu once Edit is selected", () => {
    render(<SignedInHome items={[itemRow()]} />);

    fireEvent.click(screen.getByRole("button", { name: "Actions for Rice" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));

    expect(
      screen.queryByRole("menuitem", { name: "Delete" }),
    ).not.toBeInTheDocument();
  });

  it("deletes the item immediately on selecting Delete, with no confirmation step", () => {
    render(<SignedInHome items={[itemRow()]} />);

    fireEvent.click(screen.getByRole("button", { name: "Actions for Rice" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(deleteItemMock).toHaveBeenCalledExactlyOnceWith(
      "11111111-1111-1111-1111-111111111111",
      expect.any(FormData),
    );
  });

  it("disables the decrement control once an item is out of stock", () => {
    render(<SignedInHome items={[itemRow({ quantity: "0" })]} />);

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

    render(<SignedInHome items={[itemRow({ quantity: "2" })]} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Increase Rice quantity" }),
    );

    expect(
      await screen.findByRole("cell", { name: "3 kg" }),
    ).toBeInTheDocument();
    expect(incrementItemMock).toHaveBeenCalledExactlyOnceWith(
      "11111111-1111-1111-1111-111111111111",
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

    render(<SignedInHome items={[itemRow({ quantity: "2" })]} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Decrease Rice quantity" }),
    );

    expect(
      await screen.findByRole("cell", { name: "1 kg" }),
    ).toBeInTheDocument();
    expect(decrementItemMock).toHaveBeenCalledExactlyOnceWith(
      "11111111-1111-1111-1111-111111111111",
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

    render(<SignedInHome items={[itemRow({ quantity: "0.5" })]} />);
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
      render(<SignedInHome items={sortItems()} />);

      expect(nameCells()).toEqual(["Banana", "apple", "Cherry"]);
      expect(nameHeader()).toHaveAttribute("aria-sort", "none");
      expect(amountHeader()).toHaveAttribute("aria-sort", "none");
    });

    it("sorts by name ascending on first click, case-insensitively", () => {
      render(<SignedInHome items={sortItems()} />);

      fireEvent.click(within(nameHeader()).getByRole("button"));

      expect(nameCells()).toEqual(["apple", "Banana", "Cherry"]);
      expect(nameHeader()).toHaveAttribute("aria-sort", "ascending");
    });

    it("cycles name ascending -> descending -> default on repeated clicks", () => {
      render(<SignedInHome items={sortItems()} />);
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
      render(<SignedInHome items={sortItems()} />);

      fireEvent.click(within(amountHeader()).getByRole("button"));

      expect(nameCells()).toEqual(["Cherry", "Banana", "apple"]);
      expect(amountHeader()).toHaveAttribute("aria-sort", "ascending");
    });

    it("switching to a different column always restarts at ascending", () => {
      render(<SignedInHome items={sortItems()} />);

      const nameButton = within(nameHeader()).getByRole("button");
      fireEvent.click(nameButton);
      fireEvent.click(nameButton); // now descending on name

      fireEvent.click(within(amountHeader()).getByRole("button"));

      expect(amountHeader()).toHaveAttribute("aria-sort", "ascending");
      expect(nameHeader()).toHaveAttribute("aria-sort", "none");
      expect(nameCells()).toEqual(["Cherry", "Banana", "apple"]);
    });

    it("does not make the Actions header sortable", () => {
      render(<SignedInHome items={sortItems()} />);

      const actionsHeader = screen.getByRole("columnheader", {
        name: "Actions",
      });
      expect(
        within(actionsHeader).queryByRole("button"),
      ).not.toBeInTheDocument();
      expect(actionsHeader).not.toHaveAttribute("aria-sort");
    });

    it("persists sort state to localStorage and restores it on the next render", () => {
      const { unmount } = render(<SignedInHome items={sortItems()} />);
      fireEvent.click(within(amountHeader()).getByRole("button"));
      unmount();

      render(<SignedInHome items={sortItems()} />);

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

      render(<SignedInHome items={sortItems()} />);
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
      render(<SignedInHome items={[]} />);

      expect(
        screen.queryByRole("button", { name: /^Status/ }),
      ).not.toBeInTheDocument();
    });

    it("shows every item by default, with all three boxes checked", () => {
      render(<SignedInHome items={statusItems()} />);
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
      render(<SignedInHome items={statusItems()} />);
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
      render(<SignedInHome items={statusItems()} />);
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
      const { unmount } = render(<SignedInHome items={statusItems()} />);
      openStatusDropdown();
      fireEvent.click(screen.getByRole("checkbox", { name: "Low stock" }));
      unmount();

      render(<SignedInHome items={statusItems()} />);

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

      render(<SignedInHome items={statusItems()} />);
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
});
