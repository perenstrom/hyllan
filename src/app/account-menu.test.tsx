import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  signOut: vi.fn(),
  deleteAccount: vi.fn(),
}));

const { AccountMenu } = await import("./account-menu");

describe("AccountMenu", () => {
  it("hides the menu items until the avatar is clicked", async () => {
    const user = userEvent.setup();
    render(<AccountMenu />);

    expect(
      screen.queryByRole("menuitem", { name: "Sign out" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Account menu" }));

    expect(
      screen.getByRole("menuitem", { name: "Sign out" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Delete account" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Account" })).toHaveAttribute(
      "href",
      "/account",
    );
  });

  it("closes on outside click", async () => {
    const user = userEvent.setup();
    render(<AccountMenu />);

    await user.click(screen.getByRole("button", { name: "Account menu" }));
    expect(
      screen.getByRole("menuitem", { name: "Sign out" }),
    ).toBeInTheDocument();

    // Radix's modal dropdown disables pointer events on the rest of the
    // page while open, so a real click can't land on another element the
    // way it would once the menu is closed — fire the raw pointerdown its
    // outside-dismiss listener reacts to instead.
    fireEvent.pointerDown(document.body);

    expect(
      screen.queryByRole("menuitem", { name: "Sign out" }),
    ).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(<AccountMenu />);

    await user.click(screen.getByRole("button", { name: "Account menu" }));
    expect(
      screen.getByRole("menuitem", { name: "Sign out" }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(
      screen.queryByRole("menuitem", { name: "Sign out" }),
    ).not.toBeInTheDocument();
  });

  it("supports arrow-key navigation between items", async () => {
    const user = userEvent.setup();
    render(<AccountMenu />);

    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("menuitem", { name: "Account" })).toHaveFocus();

    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("menuitem", { name: "Sign out" })).toHaveFocus();
  });

  it("opens the confirmation dialog, closes the menu, and states the deletion is immediate and irreversible", async () => {
    const user = userEvent.setup();
    render(<AccountMenu />);

    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete account" }));

    expect(
      screen.queryByRole("menuitem", { name: "Sign out" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Delete account?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/immediately and permanently deletes/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
  });

  it("closes the dialog without deleting anything when canceled", async () => {
    const user = userEvent.setup();
    render(<AccountMenu />);

    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete account" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      screen.queryByRole("heading", { name: "Delete account?" }),
    ).not.toBeInTheDocument();
  });
});
