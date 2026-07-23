// PROTOTYPE (PER-218) — pantry item list, dispatched by ?variant=a|b|c.

import { PantryListA } from "@/components/pantry/variant-a/pantry-list";
import { PantryListB } from "@/components/pantry/variant-b/pantry-list";
import { PantryListC } from "@/components/pantry/variant-c/pantry-list";
import { VariantSwitcher } from "@/components/variant-switcher";
import { resolveVariant } from "@/lib/variant";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string | string[] }>;
}) {
  const { variant: variantParam } = await searchParams;
  const variant = resolveVariant(variantParam);

  return (
    <div className="flex flex-1 flex-col">
      {variant === "a" && <PantryListA variant={variant} />}
      {variant === "b" && <PantryListB variant={variant} />}
      {variant === "c" && <PantryListC />}
      <VariantSwitcher />
    </div>
  );
}
