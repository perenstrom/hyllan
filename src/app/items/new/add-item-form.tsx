"use client";

import { addItem } from "../actions";
import { ItemForm } from "../item-form";
import type { LocationOption } from "@/lib/location";

type Props = {
  locations: LocationOption[];
};

export function AddItemForm({ locations }: Props) {
  return (
    <ItemForm
      heading="Add item"
      action={addItem}
      submitLabel="Add item"
      pendingLabel="Adding…"
      locations={locations}
    />
  );
}
