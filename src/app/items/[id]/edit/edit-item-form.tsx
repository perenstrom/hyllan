"use client";

import { editItem } from "../../actions";
import { ItemForm } from "../../item-form";
import type { LocationOption } from "@/lib/location";
import type { PantryItemUnit } from "@/lib/pantry-item";

type Props = {
  item: {
    id: string;
    name: string;
    quantity: string;
    unit: PantryItemUnit;
    minimumQuantity: string | null;
    locationId: string | null;
  };
  locations: LocationOption[];
};

export function EditItemForm({ item, locations }: Props) {
  return (
    <ItemForm
      heading="Edit item"
      action={editItem.bind(null, item.id)}
      submitLabel="Save changes"
      pendingLabel="Saving…"
      locations={locations}
      defaultValues={{
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        minimumQuantity: item.minimumQuantity,
        locationId: item.locationId,
      }}
    />
  );
}
