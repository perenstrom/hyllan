import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoadingIndicator } from "./loading-indicator";

describe("LoadingIndicator", () => {
  it("renders an accessible status", () => {
    render(<LoadingIndicator />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });
});
