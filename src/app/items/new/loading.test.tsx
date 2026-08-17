import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions", () => ({
  signOut: vi.fn(),
  deleteAccount: vi.fn(),
}));

const { default: Loading } = await import("./loading");

// Thin smoke test — the actual loading UI is AuthenticatedLoading's
// behavior, covered by src/app/authenticated-loading.test.tsx. This just
// confirms the route wires up to it.
describe("new item Loading", () => {
  it("renders the shared authenticated loading state", () => {
    render(<Loading />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });
});
