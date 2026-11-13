"use client";

import { addItem } from "../actions";
import { ItemForm } from "../item-form";
import type { LocationOption } from "@/lib/location";

type Props = {
  locations: LocationOption[];
  // From `/items/new?name=…` — a Search with no matches links here with
  // its query, so the household doesn't type the name twice.
  initialName?: string;
};

export function AddItemForm({ locations, initialName }: Props) {
  return (
    <ItemForm
      heading="Add item"
      action={addItem}
      submitLabel="Add item"
      pendingLabel="Adding…"
      locations={locations}
      initialName={initialName}
    />
  );
}
