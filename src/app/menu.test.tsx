import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Menu } from "./menu";

function renderMenu() {
  return render(
    <div>
      <Menu
        panelRole="menu"
        panelClassName="panel"
        trigger={({ open, toggle }) => (
          <button type="button" onClick={toggle} aria-expanded={open}>
            Trigger
          </button>
        )}
      >
        {({ close }) => (
          <button type="button" role="menuitem" onClick={close}>
            Item
          </button>
        )}
      </Menu>
      <button type="button">Outside</button>
    </div>,
  );
}

describe("Menu", () => {
  it("hides the panel until the trigger is clicked, and reflects state via aria-expanded", () => {
    renderMenu();

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trigger" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    fireEvent.click(screen.getByRole("button", { name: "Trigger" }));

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trigger" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("toggles closed when the trigger is clicked again", () => {
    renderMenu();

    const trigger = screen.getByRole("button", { name: "Trigger" });
    fireEvent.click(trigger);
    fireEvent.click(trigger);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes when a panel item calls close", () => {
    renderMenu();

    fireEvent.click(screen.getByRole("button", { name: "Trigger" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Item" }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes on outside click", () => {
    renderMenu();

    fireEvent.click(screen.getByRole("button", { name: "Trigger" }));
    fireEvent.mouseDown(screen.getByRole("button", { name: "Outside" }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("omits the ARIA menu role when panelRole is not passed", () => {
    render(
      <Menu
        panelClassName="panel"
        trigger={({ toggle }) => (
          <button type="button" onClick={toggle}>
            Trigger
          </button>
        )}
      >
        {() => <label>Checkbox item</label>}
      </Menu>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Trigger" }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByText("Checkbox item")).toBeInTheDocument();
  });

  it("wires the trigger's own onClick without swallowing other handlers", () => {
    const onClick = vi.fn();
    render(
      <Menu
        panelClassName="panel"
        trigger={({ toggle }) => (
          <button
            type="button"
            onClick={() => {
              onClick();
              toggle();
            }}
          >
            Trigger
          </button>
        )}
      >
        {() => <span>Content</span>}
      </Menu>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Trigger" }));

    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByText("Content")).toBeInTheDocument();
  });
});
