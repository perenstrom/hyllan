"use client";

// PROTOTYPE — wipe me. Answers the 2026-08-18 review comment: location
// rename/delete gets its own dedicated page (this one), reached from the
// item list rather than living in the header's filter dropdown. A real
// page/route rather than a modal, mirroring how /account is its own page
// for account-level settings — matches this app's existing pattern for
// "settings you visit occasionally, not per-session controls."
//
// The location list is the one piece of this prototype persisted
// (localStorage, see use-location-list.ts) so it survives navigating here
// and back — everything else (item quantities) resets on reload, which is
// fine since this page doesn't touch quantities at all.

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AppHeader } from "@/app/app-header";
import { useLocationList } from "../use-location-list";

export default function ManageLocationsPage() {
  const { locations, addLocation, renameLocation, deleteLocation } =
    useLocationList();
  const [newName, setNewName] = useState("");

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <AppHeader />
      <main className="flex flex-1 flex-col items-center gap-4 px-6 py-8">
        <div className="flex w-full max-w-sm flex-col gap-4">
          <Link
            href="/?variant=A"
            className="w-fit text-sm text-zinc-600 underline dark:text-zinc-400"
          >
            ‹ Back to pantry
          </Link>

          <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
            <div>
              <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
                Manage locations
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
                Deleting a location moves its quantity back to Unassigned.
              </p>
            </div>

            <ul className="flex flex-col gap-2">
              {locations.map((location, index) => (
                <li key={index} className="flex items-center gap-2">
                  <input
                    value={location}
                    onChange={(event) =>
                      renameLocation(index, event.target.value)
                    }
                    className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  <button
                    type="button"
                    onClick={() => deleteLocation(index)}
                    aria-label={`Delete ${location}`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
              {locations.length === 0 && (
                <li className="text-sm text-zinc-500 dark:text-zinc-500">
                  No locations yet.
                </li>
              )}
            </ul>

            <form
              className="flex gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800"
              onSubmit={(event) => {
                event.preventDefault();
                if (newName.trim()) {
                  addLocation(newName.trim());
                  setNewName("");
                }
              }}
            >
              <input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="New location"
                className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
              <button
                type="submit"
                className="shrink-0 rounded bg-black px-3 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-black"
              >
                Add
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
