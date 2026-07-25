"use client";

import { addItem } from "../actions";
import { ItemForm } from "../item-form";

export function AddItemForm() {
  return (
    <ItemForm
      heading="Add item"
      action={addItem}
      submitLabel="Add item"
      pendingLabel="Adding…"
    />
  );
}
