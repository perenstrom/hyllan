import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  signOut: vi.fn(),
  deleteAccount: vi.fn(),
}));

const { AccountMenu } = await import("./account-menu");

describe("AccountMenu", () => {
  it("hides the menu items until the avatar is clicked", () => {
    render(<AccountMenu />);

    expect(
      screen.queryByRole("menuitem", { name: "Sign out" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));

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

  it("opens the confirmation dialog, closes the menu, and states the deletion is immediate and irreversible", () => {
    render(<AccountMenu />);

    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete account" }));

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

  it("closes the dialog without deleting anything when canceled", () => {
    render(<AccountMenu />);

    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete account" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      screen.queryByRole("heading", { name: "Delete account?" }),
    ).not.toBeInTheDocument();
  });
});
