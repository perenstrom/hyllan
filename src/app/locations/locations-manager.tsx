"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";

import {
  createLocation,
  deleteLocationAction,
  renameLocationAction,
} from "./actions";
import { StockTakeLauncher } from "./stock-take-launcher";
import type { LocationOption } from "@/lib/location";
import type { PantryItemWithLocations } from "@/lib/pantry-items";

type Props = {
  locations: LocationOption[];
  items: PantryItemWithLocations[];
};

// The dedicated route rename/delete moved to (PER-288, review comment on
// PER-268's prototype) — a real page, mirroring /account's layout, rather
// than a modal or the header's filter dropdown. Deleting a location merges
// its quantity back into every affected item's unassigned bucket (ADR
// 0005), so unlike DeleteItemDialog (PER-269) there's no data-loss
// confirmation step to reuse here.
export function LocationsManager({
  locations: initialLocations,
  items,
}: Props) {
  const [locations, setLocations] = useState(initialLocations);
  const [stockTakeLocation, setStockTakeLocation] =
    useState<LocationOption | null>(null);
  const [names, setNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      initialLocations.map((location) => [location.id, location.name]),
    ),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleRenameBlur(location: LocationOption) {
    const nextName = (names[location.id] ?? location.name).trim();
    if (!nextName || nextName === location.name) {
      setNames((current) => ({ ...current, [location.id]: location.name }));
      return;
    }

    const result = await renameLocationAction(location.id, nextName);
    if (result.ok) {
      setLocations((current) =>
        current.map((entry) =>
          entry.id === location.id
            ? { ...entry, name: result.location.name }
            : entry,
        ),
      );
      setNames((current) => ({
        ...current,
        [location.id]: result.location.name,
      }));
      setErrors((current) => ({ ...current, [location.id]: "" }));
    } else {
      setNames((current) => ({ ...current, [location.id]: location.name }));
      setErrors((current) => ({ ...current, [location.id]: result.error }));
    }
  }

  async function handleDelete(location: LocationOption) {
    setLocations((current) =>
      current.filter((entry) => entry.id !== location.id),
    );
    try {
      await deleteLocationAction(location.id);
    } catch {
      // Restores the row rather than leaving the UI silently out of sync
      // with the DB on a failed delete.
      setLocations((current) => [...current, location]);
      setErrors((current) => ({
        ...current,
        [location.id]: "Couldn't delete this location. Try again.",
      }));
    }
  }

  async function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      return;
    }

    setCreateError(null);
    const result = await createLocation(trimmed);
    if (result.ok) {
      setLocations((current) => [...current, result.location]);
      setNames((current) => ({
        ...current,
        [result.location.id]: result.location.name,
      }));
      setNewName("");
    } else {
      setCreateError(result.error);
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          Manage locations
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
          Deleting a location moves its quantity back to Unassigned.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {locations.map((location) => (
          <li key={location.id} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <input
                aria-label={`Rename ${location.name}`}
                value={names[location.id] ?? location.name}
                onChange={(event) =>
                  setNames((current) => ({
                    ...current,
                    [location.id]: event.target.value,
                  }))
                }
                onBlur={() => handleRenameBlur(location)}
                className="h-9 w-full rounded border border-zinc-300 px-3 dark:border-zinc-700 dark:bg-zinc-900"
              />
              <button
                type="button"
                onClick={() => setStockTakeLocation(location)}
                className="h-9 shrink-0 rounded border border-zinc-300 px-2.5 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
              >
                Stock take
              </button>
              <button
                type="button"
                onClick={() => handleDelete(location)}
                aria-label={`Delete ${location.name}`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            {errors[location.id] && (
              <p className="text-sm text-red-600">{errors[location.id]}</p>
            )}
          </li>
        ))}
        {locations.length === 0 && (
          <li className="text-sm text-zinc-500 dark:text-zinc-500">
            No locations yet.
          </li>
        )}
      </ul>

      <form
        className="flex flex-col gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800"
        onSubmit={handleAdd}
      >
        <div className="flex gap-2">
          <input
            aria-label="New location"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="New location"
            className="h-9 w-full rounded border border-zinc-300 px-3 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            className="h-9 shrink-0 rounded bg-black px-3 text-sm font-medium text-white dark:bg-zinc-50 dark:text-black"
          >
            Add
          </button>
        </div>
        {createError && <p className="text-sm text-red-600">{createError}</p>}
      </form>

      {stockTakeLocation && (
        <StockTakeLauncher
          location={stockTakeLocation}
          items={items}
          onClose={() => setStockTakeLocation(null)}
        />
      )}
    </div>
  );
}
