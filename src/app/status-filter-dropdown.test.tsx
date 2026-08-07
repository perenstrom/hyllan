import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_STATUS_FILTER } from "@/lib/pantry-item";
import { StatusFilterDropdown } from "./status-filter-dropdown";

describe("StatusFilterDropdown", () => {
  it("hides the checkboxes until the trigger is clicked", () => {
    render(
      <StatusFilterDropdown
        filter={DEFAULT_STATUS_FILTER}
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("checkbox", { name: "In stock" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Status" }));

    expect(screen.getByRole("checkbox", { name: "In stock" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Low stock" })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Out of stock" }),
    ).toBeChecked();
  });

  it("shows a plain 'Status' label for the default (all-checked) filter", () => {
    render(
      <StatusFilterDropdown
        filter={DEFAULT_STATUS_FILTER}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Status" })).toBeInTheDocument();
  });

  it("shows an active-filter count once the selection isn't the all-checked default", () => {
    render(
      <StatusFilterDropdown
        filter={{ ...DEFAULT_STATUS_FILTER, "low-stock": false }}
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Status (2/3)" }),
    ).toBeInTheDocument();
  });

  it("reports the toggled filter through onChange without mutating the passed-in filter", () => {
    const onChange = vi.fn();
    render(
      <StatusFilterDropdown
        filter={DEFAULT_STATUS_FILTER}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Status" }));

    fireEvent.click(screen.getByRole("checkbox", { name: "Out of stock" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      "in-stock": true,
      "low-stock": true,
      "out-of-stock": false,
    });
    expect(DEFAULT_STATUS_FILTER["out-of-stock"]).toBe(true);
  });

  it("closes the dropdown when clicking outside it", () => {
    render(
      <div>
        <StatusFilterDropdown
          filter={DEFAULT_STATUS_FILTER}
          onChange={vi.fn()}
        />
        <button type="button">Outside</button>
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Status" }));
    expect(
      screen.getByRole("checkbox", { name: "In stock" }),
    ).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("button", { name: "Outside" }));

    expect(
      screen.queryByRole("checkbox", { name: "In stock" }),
    ).not.toBeInTheDocument();
  });
});
