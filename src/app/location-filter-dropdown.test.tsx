import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LocationFilterDropdown } from "./location-filter-dropdown";

const LOCATIONS = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Pantry" },
  { id: "22222222-2222-2222-2222-222222222222", name: "Garage fridge" },
];

describe("LocationFilterDropdown", () => {
  it("hides the checkboxes until the trigger is clicked", async () => {
    const user = userEvent.setup();
    render(
      <LocationFilterDropdown
        locations={LOCATIONS}
        hiddenKeys={new Set()}
        onToggle={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("checkbox", { name: "Pantry" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Locations" }));

    expect(screen.getByRole("checkbox", { name: "Pantry" })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Garage fridge" }),
    ).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Unassigned" })).toBeChecked();
  });

  it("shows a plain 'Locations' label when nothing is hidden", () => {
    render(
      <LocationFilterDropdown
        locations={LOCATIONS}
        hiddenKeys={new Set()}
        onToggle={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Locations" }),
    ).toBeInTheDocument();
  });

  it("shows a shown/total count once something is hidden", () => {
    render(
      <LocationFilterDropdown
        locations={LOCATIONS}
        hiddenKeys={new Set([LOCATIONS[0].id])}
        onToggle={vi.fn()}
      />,
    );

    // 2 locations + Unassigned = 3 total, one hidden.
    expect(
      screen.getByRole("button", { name: "Locations (2/3)" }),
    ).toBeInTheDocument();
  });

  it("reports the toggled key through onToggle", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <LocationFilterDropdown
        locations={LOCATIONS}
        hiddenKeys={new Set()}
        onToggle={onToggle}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Locations" }));

    await user.click(screen.getByRole("checkbox", { name: "Pantry" }));

    expect(onToggle).toHaveBeenCalledExactlyOnceWith(LOCATIONS[0].id);
  });

  it("reports the unassigned sentinel key when that checkbox is toggled", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <LocationFilterDropdown
        locations={LOCATIONS}
        hiddenKeys={new Set()}
        onToggle={onToggle}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Locations" }));

    await user.click(screen.getByRole("checkbox", { name: "Unassigned" }));

    expect(onToggle).toHaveBeenCalledExactlyOnceWith("unassigned");
  });

  it("links to the manage-locations page", async () => {
    const user = userEvent.setup();
    render(
      <LocationFilterDropdown
        locations={LOCATIONS}
        hiddenKeys={new Set()}
        onToggle={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Locations" }));

    expect(
      screen.getByRole("link", { name: "Manage locations →" }),
    ).toHaveAttribute("href", "/locations");
  });

  it("closes the dropdown when clicking outside it", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <LocationFilterDropdown
          locations={LOCATIONS}
          hiddenKeys={new Set()}
          onToggle={vi.fn()}
        />
        <button type="button">Outside</button>
      </div>,
    );
    await user.click(screen.getByRole("button", { name: "Locations" }));
    expect(
      screen.getByRole("checkbox", { name: "Pantry" }),
    ).toBeInTheDocument();

    // Popover (unlike DropdownMenu) defers its outside-pointerdown dismissal
    // to the following click event, so both need firing here.
    fireEvent.pointerDown(document.body);
    fireEvent.click(document.body);

    expect(
      screen.queryByRole("checkbox", { name: "Pantry" }),
    ).not.toBeInTheDocument();
  });
});
