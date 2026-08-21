import { fireEvent, render, screen } from "@testing-library/react";
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

    expect(screen.getByRole("button", { name: "Pantry" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Unassigned" }),
    ).not.toBeInTheDocument();
  });

  it("selects an existing location and reports it through onChange", () => {
    const { onChange } = renderCombobox();
    clear();

    fireEvent.mouseDown(screen.getByRole("button", { name: "Pantry" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith("loc-1");
    expect(field()).toHaveValue("Pantry");
  });

  it("offers to create a new location when the typed text matches nothing", () => {
    renderCombobox();
    clear();

    fireEvent.change(field(), { target: { value: "Garage fridge" } });

    expect(
      screen.getByRole("button", {
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
      screen.getByRole("button", {
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
      screen.getByRole("button", {
        name: "Add “Garage fridge” as new location",
      }),
    );

    expect(
      await screen.findByText("You already have a location with that name."),
    ).toBeInTheDocument();
  });
});
