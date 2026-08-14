import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions", () => ({
  signOut: vi.fn(),
  deleteAccount: vi.fn(),
}));

const { default: Loading } = await import("./loading");

describe("new item Loading", () => {
  it("shows the app header and a loading status", () => {
    render(<Loading />);

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });
});
