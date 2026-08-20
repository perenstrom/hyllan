import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createLocationMock = vi.fn();
const renameLocationActionMock = vi.fn();
const deleteLocationActionMock = vi.fn();

vi.mock("./actions", () => ({
  createLocation: (...args: unknown[]) => createLocationMock(...args),
  renameLocationAction: (...args: unknown[]) =>
    renameLocationActionMock(...args),
  deleteLocationAction: (...args: unknown[]) =>
    deleteLocationActionMock(...args),
}));

const { LocationsManager } = await import("./locations-manager");

const PANTRY = { id: "11111111-1111-1111-1111-111111111111", name: "Pantry" };
const FREEZER = { id: "22222222-2222-2222-2222-222222222222", name: "Freezer" };

describe("LocationsManager", () => {
  beforeEach(() => {
    createLocationMock.mockReset();
    renameLocationActionMock.mockReset();
    deleteLocationActionMock.mockReset();
  });

  it("shows a message when there are no locations yet", () => {
    render(<LocationsManager locations={[]} />);

    expect(screen.getByText("No locations yet.")).toBeInTheDocument();
  });

  it("lists each location with a rename input and a delete button", () => {
    render(<LocationsManager locations={[PANTRY, FREEZER]} />);

    expect(screen.getByLabelText("Rename Pantry")).toHaveValue("Pantry");
    expect(screen.getByLabelText("Rename Freezer")).toHaveValue("Freezer");
    expect(
      screen.getByRole("button", { name: "Delete Pantry" }),
    ).toBeInTheDocument();
  });

  it("renames a location on blur and calls the server action", async () => {
    renameLocationActionMock.mockResolvedValue({
      ok: true,
      location: { id: PANTRY.id, name: "Kitchen pantry" },
    });
    render(<LocationsManager locations={[PANTRY]} />);

    const input = screen.getByLabelText("Rename Pantry");
    fireEvent.change(input, { target: { value: "Kitchen pantry" } });
    fireEvent.blur(input);

    expect(
      await screen.findByDisplayValue("Kitchen pantry"),
    ).toBeInTheDocument();
    expect(renameLocationActionMock).toHaveBeenCalledExactlyOnceWith(
      PANTRY.id,
      "Kitchen pantry",
    );
  });

  it("does not call the server action when the name is unchanged", () => {
    render(<LocationsManager locations={[PANTRY]} />);

    const input = screen.getByLabelText("Rename Pantry");
    fireEvent.blur(input);

    expect(renameLocationActionMock).not.toHaveBeenCalled();
  });

  it("reverts to the original name and shows an error when the rename fails", async () => {
    renameLocationActionMock.mockResolvedValue({
      ok: false,
      error: "You already have a location with that name.",
    });
    render(<LocationsManager locations={[PANTRY, FREEZER]} />);

    const input = screen.getByLabelText("Rename Pantry");
    fireEvent.change(input, { target: { value: "Freezer" } });
    fireEvent.blur(input);

    expect(
      await screen.findByText("You already have a location with that name."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Rename Pantry")).toHaveValue("Pantry");
  });

  it("removes the location from the list when deleted", async () => {
    render(<LocationsManager locations={[PANTRY, FREEZER]} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete Pantry" }));

    expect(deleteLocationActionMock).toHaveBeenCalledExactlyOnceWith(PANTRY.id);
    expect(screen.queryByLabelText("Rename Pantry")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Rename Freezer")).toBeInTheDocument();
  });

  it("adds a new location through the bottom field", async () => {
    createLocationMock.mockResolvedValue({
      ok: true,
      location: { id: "33333333-3333-3333-3333-333333333333", name: "Garage" },
    });
    render(<LocationsManager locations={[]} />);

    fireEvent.change(screen.getByLabelText("New location"), {
      target: { value: "Garage" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByLabelText("Rename Garage")).toBeInTheDocument();
    expect(createLocationMock).toHaveBeenCalledExactlyOnceWith("Garage");
    expect(screen.getByLabelText<HTMLInputElement>("New location").value).toBe(
      "",
    );
  });

  it("shows an error and keeps the typed name when creation fails", async () => {
    createLocationMock.mockResolvedValue({
      ok: false,
      error: "You already have a location with that name.",
    });
    render(<LocationsManager locations={[]} />);

    fireEvent.change(screen.getByLabelText("New location"), {
      target: { value: "Pantry" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(
      await screen.findByText("You already have a location with that name."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText<HTMLInputElement>("New location").value).toBe(
      "Pantry",
    );
  });

  it("does not submit a blank new-location name", () => {
    render(<LocationsManager locations={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(createLocationMock).not.toHaveBeenCalled();
  });
});
