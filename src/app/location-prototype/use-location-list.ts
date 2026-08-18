"use client";

// PROTOTYPE — wipe me. The household's mock location list, shared between
// the item list (usePrototypeLocationState) and the standalone manage page
// (manage/page.tsx) — persisted to localStorage, not just component state,
// so navigating to the manage page and back doesn't reset it. Everything
// else about this prototype (item breakdowns, quantities) stays in-memory
// only; this is the one exception, made because "a separate page" only
// demonstrates anything if the list survives the trip there and back.

import { useEffect, useState } from "react";

import { DEFAULT_LOCATIONS } from "./mock-data";

const STORAGE_KEY = "hyllan-prototype:per-268:locations";

function readStored(): string[] {
  if (typeof window === "undefined") return DEFAULT_LOCATIONS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LOCATIONS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((v) => typeof v === "string")
      ? parsed
      : DEFAULT_LOCATIONS;
  } catch {
    return DEFAULT_LOCATIONS;
  }
}

export function useLocationList() {
  const [locations, setLocationsState] = useState<string[]>(readStored);

  function persist(next: string[]) {
    setLocationsState(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  // Picks up edits made on the manage page in another tab/window — a nice
  // side effect of using localStorage, not the reason for it.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEY) setLocationsState(readStored());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function addLocation(name: string) {
    if (locations.some((loc) => loc.toLowerCase() === name.toLowerCase())) {
      return;
    }
    persist([...locations, name]);
  }

  function renameLocation(index: number, name: string) {
    persist(locations.map((loc, i) => (i === index ? name : loc)));
  }

  function deleteLocation(index: number) {
    persist(locations.filter((_, i) => i !== index));
  }

  return { locations, addLocation, renameLocation, deleteLocation };
}
