import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../actions", () => ({
  signOut: vi.fn(),
  deleteAccount: vi.fn(),
}));

const { AccountActions } = await import("./account-actions");

describe("AccountActions", () => {
  it("offers sign out and delete account", () => {
    render(<AccountActions />);

    expect(
      screen.getByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete account" }),
    ).toBeInTheDocument();
  });

  it("puts delete account behind a confirmation dialog stating the deletion is immediate and irreversible", () => {
    render(<AccountActions />);

    expect(
      screen.queryByRole("heading", { name: "Delete account?" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));

    expect(
      screen.getByRole("heading", { name: "Delete account?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/immediately and permanently deletes/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
  });
});
