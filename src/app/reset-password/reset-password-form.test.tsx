import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ResetPasswordForm } from "./reset-password-form";

describe("ResetPasswordForm", () => {
  it("renders new and confirm password fields", () => {
    render(<ResetPasswordForm formAction={vi.fn()} pending={false} />);

    expect(screen.getByLabelText("New password")).toHaveAttribute(
      "type",
      "password",
    );
    expect(screen.getByLabelText("Confirm new password")).toHaveAttribute(
      "type",
      "password",
    );
  });

  it("shows the given error", () => {
    render(
      <ResetPasswordForm
        formAction={vi.fn()}
        pending={false}
        error="New password and confirmation do not match."
      />,
    );

    expect(
      screen.getByText("New password and confirmation do not match."),
    ).toBeInTheDocument();
  });

  it("disables the submit button while pending", () => {
    render(<ResetPasswordForm formAction={vi.fn()} pending={true} />);

    expect(
      screen.getByRole("button", { name: "Resetting password…" }),
    ).toBeDisabled();
  });
});
