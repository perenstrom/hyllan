import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestPasswordResetMock = vi.fn();

vi.mock("./request-password-reset", () => ({
  requestPasswordReset: (...args: unknown[]) =>
    requestPasswordResetMock(...args),
}));

const { ForgotPasswordForm } = await import("./forgot-password-form");

describe("ForgotPasswordForm", () => {
  beforeEach(() => {
    requestPasswordResetMock.mockReset();
  });

  it("renders an email field", () => {
    render(<ForgotPasswordForm />);

    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
  });

  it("shows a generic confirmation message on success, replacing the form", async () => {
    requestPasswordResetMock.mockResolvedValue({ success: true });

    render(<ForgotPasswordForm />);
    fireEvent.submit(
      screen.getByRole("button", { name: "Send reset link" }).closest("form")!,
    );

    expect(
      await screen.findByText(
        "If an account exists for that email, we've sent a link to reset your password.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
  });

  it("shows the error returned by the submit handler", async () => {
    requestPasswordResetMock.mockResolvedValue({
      error: "Email rate limit exceeded",
    });

    render(<ForgotPasswordForm />);
    fireEvent.submit(
      screen.getByRole("button", { name: "Send reset link" }).closest("form")!,
    );

    expect(
      await screen.findByText("Email rate limit exceeded"),
    ).toBeInTheDocument();
  });
});
