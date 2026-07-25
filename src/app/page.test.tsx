import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SignedOutHome } from "./signed-out-home";

describe("SignedOutHome", () => {
  it("renders the app name", () => {
    render(<SignedOutHome />);

    expect(screen.getByRole("heading", { name: "Hyllan" })).toBeInTheDocument();
  });
});
