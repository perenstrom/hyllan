"use client";

import { useEffect, useRef, useState } from "react";

import { ShelfToStockDialog } from "./shelf-to-stock-dialog";
import { StockToShelfDialog } from "./stock-to-shelf-dialog";
import type { LocationOption } from "@/lib/location";
import type { PantryItemWithLocations } from "@/lib/pantry-items";

type Props = {
  location: LocationOption;
  items: PantryItemWithLocations[];
  onClose: () => void;
};

type Mode = "start" | "stock-to-shelf" | "shelf-to-stock";

// The "start a stock take" screen (PER-265): two independent entry points,
// not sequential phases of one pass — validated in the /prototype branch
// referenced on the ticket, which rejected an earlier draft appending
// shelf-to-stock after the walkthrough's last item. Picking a flow swaps
// this dialog out for the chosen one; closing either flow (including this
// picker) ends the whole launcher, never returning to this screen.
export function StockTakeLauncher({ location, items, onClose }: Props) {
  const [mode, setMode] = useState<Mode>("start");
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (mode === "start") {
      dialogRef.current?.showModal();
    }
  }, [mode]);

  if (mode === "stock-to-shelf") {
    return (
      <StockToShelfDialog location={location} items={items} onClose={onClose} />
    );
  }

  if (mode === "shelf-to-stock") {
    return (
      <ShelfToStockDialog location={location} items={items} onClose={onClose} />
    );
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="m-auto w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 backdrop:bg-black/40 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
        Start a stock take
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {location.name}
      </p>

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setMode("stock-to-shelf")}
          className="rounded border border-zinc-300 px-3 py-2 text-left text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
        >
          Go through everything recorded here
        </button>
        <button
          type="button"
          onClick={() => setMode("shelf-to-stock")}
          className="rounded border border-zinc-300 px-3 py-2 text-left text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
        >
          Look up one item
        </button>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
        >
          Cancel
        </button>
      </div>
    </dialog>
  );
}
