import { fireEvent, render, screen } from "@testing-library/react";
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

    expect(screen.getByRole("button", { name: "Rice" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Beans" }),
    ).not.toBeInTheDocument();
  });

  it("selects an item and reports it through onChange", () => {
    const { onChange } = renderCombobox();

    fireEvent.focus(field());
    fireEvent.mouseDown(screen.getByRole("button", { name: "Rice" }));

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
});
