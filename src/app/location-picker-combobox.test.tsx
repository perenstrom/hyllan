import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createLocationMock = vi.fn();

vi.mock("./locations/actions", () => ({
  createLocation: (...args: unknown[]) => createLocationMock(...args),
}));

const { LocationPickerCombobox } = await import("./location-picker-combobox");

function renderCombobox(
  overrides: Partial<Parameters<typeof LocationPickerCombobox>[0]> = {},
) {
  const onChange = vi.fn();
  const onLocationCreated = vi.fn();
  const utils = render(
    <LocationPickerCombobox
      locations={[{ id: "loc-1", name: "Pantry" }]}
      value={null}
      onChange={onChange}
      onLocationCreated={onLocationCreated}
      {...overrides}
    />,
  );
  return { ...utils, onChange, onLocationCreated };
}

function field() {
  return screen.getByPlaceholderText("Search or add a location");
}

function clear() {
  fireEvent.focus(field());
  fireEvent.change(field(), { target: { value: "" } });
}

describe("LocationPickerCombobox", () => {
  beforeEach(() => {
    createLocationMock.mockReset();
  });

  it("defaults the visible text to Unassigned when value is null", () => {
    renderCombobox();

    expect(field()).toHaveValue("Unassigned");
  });

  it("shows the selected location's name when value is set", () => {
    renderCombobox({ value: "loc-1" });

    expect(field()).toHaveValue("Pantry");
  });

  it("submits the location id, not the display name, through a hidden field", () => {
    const { container } = renderCombobox({ value: "loc-1" });

    const hidden = container.querySelector(
      'input[type="hidden"][name="locationId"]',
    );
    expect(hidden).toHaveValue("loc-1");
  });

  it("submits an empty string for Unassigned", () => {
    const { container } = renderCombobox({ value: null });

    const hidden = container.querySelector(
      'input[type="hidden"][name="locationId"]',
    );
    expect(hidden).toHaveValue("");
  });

  it("filters options as the user types", () => {
    renderCombobox();
    clear();

    fireEvent.change(field(), { target: { value: "pan" } });

    expect(screen.getByRole("option", { name: "Pantry" })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Unassigned" }),
    ).not.toBeInTheDocument();
  });

  it("selects an existing location and reports it through onChange", () => {
    const { onChange } = renderCombobox();
    clear();

    fireEvent.mouseDown(screen.getByRole("option", { name: "Pantry" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith("loc-1");
    expect(field()).toHaveValue("Pantry");
  });

  it("offers to create a new location when the typed text matches nothing", () => {
    renderCombobox();
    clear();

    fireEvent.change(field(), { target: { value: "Garage fridge" } });

    expect(
      screen.getByRole("option", {
        name: "Add “Garage fridge” as new location",
      }),
    ).toBeInTheDocument();
  });

  it("does not offer to create a location that already exists", () => {
    renderCombobox();
    clear();

    fireEvent.change(field(), { target: { value: "Pantry" } });

    expect(
      screen.queryByText("Add “Pantry” as new location"),
    ).not.toBeInTheDocument();
  });

  it("creates the location, selects it, and reports it via onLocationCreated", async () => {
    createLocationMock.mockResolvedValue({
      ok: true,
      location: { id: "loc-2", name: "Garage fridge" },
    });
    const { onChange, onLocationCreated } = renderCombobox();
    clear();
    fireEvent.change(field(), { target: { value: "Garage fridge" } });

    fireEvent.mouseDown(
      screen.getByRole("option", {
        name: "Add “Garage fridge” as new location",
      }),
    );

    expect(createLocationMock).toHaveBeenCalledExactlyOnceWith("Garage fridge");
    expect(
      await screen.findByDisplayValue("Garage fridge"),
    ).toBeInTheDocument();
    expect(onLocationCreated).toHaveBeenCalledExactlyOnceWith({
      id: "loc-2",
      name: "Garage fridge",
    });
    expect(onChange).toHaveBeenCalledExactlyOnceWith("loc-2");
  });

  it("shows a friendly error and keeps the field open when creation fails", async () => {
    createLocationMock.mockResolvedValue({
      ok: false,
      error: "You already have a location with that name.",
    });
    renderCombobox();
    clear();
    fireEvent.change(field(), { target: { value: "Garage fridge" } });

    fireEvent.mouseDown(
      screen.getByRole("option", {
        name: "Add “Garage fridge” as new location",
      }),
    );

    expect(
      await screen.findByText("You already have a location with that name."),
    ).toBeInTheDocument();
  });

  describe("keyboard", () => {
    function renderInForm() {
      const onSubmit = vi.fn((event: React.FormEvent) =>
        event.preventDefault(),
      );
      const onChange = vi.fn();
      const onLocationCreated = vi.fn();
      const utils = render(
        <form onSubmit={onSubmit}>
          <LocationPickerCombobox
            locations={[
              { id: "loc-1", name: "Pantry" },
              { id: "loc-2", name: "Pantry shelf" },
            ]}
            value={null}
            onChange={onChange}
            onLocationCreated={onLocationCreated}
          />
          <button type="submit">Save</button>
        </form>,
      );
      return { ...utils, onSubmit, onChange, onLocationCreated };
    }

    function highlighted() {
      const option = screen.getByRole("option", { selected: true });
      expect(field()).toHaveAttribute("aria-activedescendant", option.id);
      return option;
    }

    it("arrows through Unassigned and the locations without wrapping, and ArrowUp from the top clears", async () => {
      const user = userEvent.setup();
      renderInForm();

      await user.click(field());
      // Focus selects the "Unassigned" default; clear it to see everything.
      await user.keyboard("{Backspace}");
      expect(field()).not.toHaveAttribute("aria-activedescendant");
      await user.keyboard("{ArrowDown}");
      expect(highlighted()).toHaveAccessibleName("Unassigned");
      await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
      expect(highlighted()).toHaveAccessibleName("Pantry shelf");
      await user.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}");
      expect(field()).not.toHaveAttribute("aria-activedescendant");
    });

    it("clears the highlight when the text changes", async () => {
      const user = userEvent.setup();
      renderInForm();

      await user.click(field());
      await user.keyboard("{ArrowDown}");
      await user.keyboard("p");

      expect(field()).not.toHaveAttribute("aria-activedescendant");
    });

    it("selects the highlighted location on Enter without submitting the form", async () => {
      const user = userEvent.setup();
      const { onSubmit, onChange } = renderInForm();

      await user.click(field());
      await user.keyboard("pan{ArrowDown}{ArrowDown}{Enter}");

      expect(onChange).toHaveBeenCalledExactlyOnceWith("loc-2");
      expect(field()).toHaveValue("Pantry shelf");
      expect(field()).toHaveFocus();
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("keeps the hidden locationId in step with a keyboard selection", async () => {
      const user = userEvent.setup();
      function Controlled() {
        const [value, setValue] = useState<string | null>(null);
        return (
          <LocationPickerCombobox
            locations={[{ id: "loc-1", name: "Pantry" }]}
            value={value}
            onChange={setValue}
            onLocationCreated={vi.fn()}
          />
        );
      }
      const { container } = render(<Controlled />);

      await user.click(field());
      await user.keyboard("pan{ArrowDown}{Enter}");

      expect(
        container.querySelector('input[type="hidden"][name="locationId"]'),
      ).toHaveValue("loc-1");
    });

    it("creates the location when its Add row is highlighted on Enter", async () => {
      createLocationMock.mockResolvedValue({
        ok: true,
        location: { id: "loc-3", name: "Garage" },
      });
      const user = userEvent.setup();
      const { onSubmit, onChange, onLocationCreated } = renderInForm();

      await user.click(field());
      await user.keyboard("Garage{ArrowDown}");
      expect(highlighted()).toHaveAccessibleName(
        "Add “Garage” as new location",
      );
      await user.keyboard("{Enter}");

      expect(createLocationMock).toHaveBeenCalledExactlyOnceWith("Garage");
      expect(await screen.findByDisplayValue("Garage")).toBeInTheDocument();
      expect(onLocationCreated).toHaveBeenCalledExactlyOnceWith({
        id: "loc-3",
        name: "Garage",
      });
      expect(onChange).toHaveBeenCalledExactlyOnceWith("loc-3");
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("doesn't create twice while a create is pending", async () => {
      createLocationMock.mockReturnValue(new Promise(() => {}));
      const user = userEvent.setup();
      renderInForm();

      await user.click(field());
      await user.keyboard("Garage{ArrowDown}{Enter}{Enter}");

      expect(createLocationMock).toHaveBeenCalledOnce();
    });

    it("leaves Enter to the form when nothing is highlighted", async () => {
      const user = userEvent.setup();
      const { onSubmit, onChange } = renderInForm();

      await user.click(field());
      await user.keyboard("{Enter}");

      expect(onSubmit).toHaveBeenCalledOnce();
      expect(onChange).not.toHaveBeenCalled();
    });

    it("closes the list on Escape and keeps the typed text", async () => {
      const user = userEvent.setup();
      renderInForm();

      await user.click(field());
      await user.keyboard("pan{ArrowDown}{Escape}");

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(field()).toHaveValue("pan");
    });
  });
});
