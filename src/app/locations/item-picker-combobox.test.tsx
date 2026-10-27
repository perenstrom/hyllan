import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ItemPickerCombobox } from "./item-picker-combobox";

const RICE = { id: "item-1", name: "Rice" };
const BEANS = { id: "item-2", name: "Beans" };

function renderCombobox(
  overrides: Partial<Parameters<typeof ItemPickerCombobox>[0]> = {},
) {
  const onChange = vi.fn();
  const utils = render(
    <ItemPickerCombobox
      items={[RICE, BEANS]}
      value={null}
      onChange={onChange}
      {...overrides}
    />,
  );
  return { ...utils, onChange };
}

function field() {
  return screen.getByPlaceholderText("Search for an item");
}

describe("ItemPickerCombobox", () => {
  it("starts blank when no item is selected", () => {
    renderCombobox();

    expect(field()).toHaveValue("");
  });

  it("shows the selected item's name when value is set", () => {
    renderCombobox({ value: "item-1" });

    expect(field()).toHaveValue("Rice");
  });

  it("filters options as the user types", () => {
    renderCombobox();

    fireEvent.focus(field());
    fireEvent.change(field(), { target: { value: "ri" } });

    expect(screen.getByRole("option", { name: "Rice" })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Beans" }),
    ).not.toBeInTheDocument();
  });

  it("selects an item and reports it through onChange", () => {
    const { onChange } = renderCombobox();

    fireEvent.focus(field());
    fireEvent.mouseDown(screen.getByRole("option", { name: "Rice" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith("item-1");
    expect(field()).toHaveValue("Rice");
  });

  it("shows no matches instead of an option to create one", () => {
    renderCombobox();

    fireEvent.focus(field());
    fireEvent.change(field(), { target: { value: "Oats" } });

    expect(screen.getByText("No matches")).toBeInTheDocument();
    expect(screen.queryByText(/Add/)).not.toBeInTheDocument();
  });

  describe("keyboard", () => {
    it("highlights nothing when the list opens, then arrows move the highlight without wrapping", async () => {
      const user = userEvent.setup();
      renderCombobox();

      await user.click(field());
      expect(field()).toHaveAttribute("role", "combobox");
      expect(field()).toHaveAttribute("aria-expanded", "true");
      expect(field()).not.toHaveAttribute("aria-activedescendant");
      expect(screen.getByRole("listbox")).toHaveAttribute(
        "id",
        field().getAttribute("aria-controls"),
      );

      await user.keyboard("{ArrowDown}");
      expect(highlighted()).toHaveAccessibleName("Rice");
      await user.keyboard("{ArrowDown}{ArrowDown}");
      expect(highlighted()).toHaveAccessibleName("Beans");
      await user.keyboard("{ArrowUp}");
      expect(highlighted()).toHaveAccessibleName("Rice");
      await user.keyboard("{ArrowUp}");
      expect(field()).not.toHaveAttribute("aria-activedescendant");
      expect(
        screen.queryByRole("option", { selected: true }),
      ).not.toBeInTheDocument();
    });

    it("clears the highlight when the text changes", async () => {
      const user = userEvent.setup();
      renderCombobox();

      await user.click(field());
      await user.keyboard("{ArrowDown}");
      await user.type(field(), "r");

      expect(field()).not.toHaveAttribute("aria-activedescendant");
    });

    it("selects the highlighted item on Enter and keeps focus in the field", async () => {
      const user = userEvent.setup();
      const { onChange } = renderCombobox();

      await user.click(field());
      await user.type(field(), "bea");
      await user.keyboard("{ArrowDown}{Enter}");

      expect(onChange).toHaveBeenCalledExactlyOnceWith("item-2");
      expect(field()).toHaveValue("Beans");
      expect(field()).toHaveFocus();
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("leaves Enter alone when nothing is highlighted", async () => {
      const user = userEvent.setup();
      const onKeyDown = vi.fn();
      render(
        <div onKeyDown={(event) => onKeyDown(event.defaultPrevented)}>
          <ItemPickerCombobox
            items={[RICE, BEANS]}
            value={null}
            onChange={vi.fn()}
          />
        </div>,
      );

      await user.click(field());
      await user.keyboard("{Enter}");

      expect(onKeyDown).toHaveBeenCalledExactlyOnceWith(false);
    });

    it("reopens a closed list on ArrowDown", async () => {
      const user = userEvent.setup();
      renderCombobox();

      await user.click(field());
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      await user.keyboard("{ArrowDown}");

      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    it("closes an open list on Escape, keeping the text and stopping the event, then lets a second Escape through", async () => {
      const user = userEvent.setup();
      const onKeyDown = vi.fn();
      render(
        <div onKeyDown={(event) => onKeyDown(event.key)}>
          <ItemPickerCombobox
            items={[RICE, BEANS]}
            value={null}
            onChange={vi.fn()}
          />
        </div>,
      );

      await user.click(field());
      await user.type(field(), "ri");
      await user.keyboard("{ArrowDown}{Escape}");

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(field()).toHaveAttribute("aria-expanded", "false");
      expect(field()).toHaveValue("ri");
      expect(onKeyDown).not.toHaveBeenCalledWith("Escape");

      await user.keyboard("{Escape}");
      expect(onKeyDown).toHaveBeenCalledWith("Escape");
    });
  });
});

function highlighted() {
  const id = field().getAttribute("aria-activedescendant");
  const option = screen.getByRole("option", { selected: true });
  expect(option).toHaveAttribute("id", id);
  return option;
}
