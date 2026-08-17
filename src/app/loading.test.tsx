import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Loading from "./loading";

describe("root Loading", () => {
  it("shows the loading status without an AppHeader", () => {
    render(<Loading />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
  });
});
