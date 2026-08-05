import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const changePasswordMock = vi.fn();

vi.mock("./change-password", () => ({
  changePassword: (...args: unknown[]) => changePasswordMock(...args),
}));

const { ChangePasswordForm } = await import("./change-password-form");

describe("ChangePasswordForm", () => {
  beforeEach(() => {
    changePasswordMock.mockReset();
  });

  it("renders current, new, and confirm password fields", () => {
    render(<ChangePasswordForm email="user@example.com" />);

    expect(screen.getByLabelText("Current password")).toHaveAttribute(
      "type",
      "password",
    );
    expect(screen.getByLabelText("New password")).toHaveAttribute(
      "type",
      "password",
    );
    expect(screen.getByLabelText("Confirm new password")).toHaveAttribute(
      "type",
      "password",
    );
  });

  it("submits with the signed-in user's email bound in", async () => {
    changePasswordMock.mockResolvedValue({ success: true });

    render(<ChangePasswordForm email="user@example.com" />);
    fireEvent.submit(
      screen.getByRole("button", { name: "Change password" }).closest("form")!,
    );

    await screen.findByText("Password changed.");
    expect(changePasswordMock).toHaveBeenCalledExactlyOnceWith(
      "user@example.com",
      undefined,
      expect.any(FormData),
    );
  });

  it("shows the error returned by the submit handler", async () => {
    changePasswordMock.mockResolvedValue({
      error: "Current password is incorrect.",
    });

    render(<ChangePasswordForm email="user@example.com" />);
    fireEvent.submit(
      screen.getByRole("button", { name: "Change password" }).closest("form")!,
    );

    expect(
      await screen.findByText("Current password is incorrect."),
    ).toBeInTheDocument();
  });
});
