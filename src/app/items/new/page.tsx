// PROTOTYPE (PER-218) — add/edit item, dispatched by ?variant=a|b|c.

import { AddItemFormA } from "@/components/pantry/variant-a/add-item-form";
import { AddItemFormB } from "@/components/pantry/variant-b/add-item-form";
import { AddItemPageC } from "@/components/pantry/variant-c/add-item-page";
import { VariantSwitcher } from "@/components/variant-switcher";
import { resolveVariant } from "@/lib/variant";

export default async function NewItemPage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string | string[] }>;
}) {
  const { variant: variantParam } = await searchParams;
  const variant = resolveVariant(variantParam);

  return (
    <div className="flex flex-1 flex-col">
      {variant === "a" && <AddItemFormA variant={variant} />}
      {variant === "b" && <AddItemFormB variant={variant} />}
      {variant === "c" && <AddItemPageC />}
      <VariantSwitcher />
    </div>
  );
}
