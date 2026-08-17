import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions", () => ({
  signOut: vi.fn(),
  deleteAccount: vi.fn(),
}));

const { AuthenticatedLoading } = await import("./authenticated-loading");

describe("AuthenticatedLoading", () => {
  it("shows the app header and a loading status", () => {
    render(<AuthenticatedLoading />);

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });

  it("defaults to a plain flex column wrapper", () => {
    const { container } = render(<AuthenticatedLoading />);

    expect(container.firstChild).toHaveClass("flex", "flex-1", "flex-col");
  });

  it("accepts a custom wrapper className", () => {
    const { container } = render(
      <AuthenticatedLoading className="flex flex-1 flex-col bg-zinc-50" />,
    );

    expect(container.firstChild).toHaveClass("bg-zinc-50");
  });
});
