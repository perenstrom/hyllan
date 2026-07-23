// PROTOTYPE (PER-218) — account basics, dispatched by ?variant=a|b|c.

import { AccountA } from "@/components/pantry/variant-a/account";
import { AccountB } from "@/components/pantry/variant-b/account";
import { AccountC } from "@/components/pantry/variant-c/account";
import { VariantSwitcher } from "@/components/variant-switcher";
import { resolveVariant } from "@/lib/variant";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string | string[] }>;
}) {
  const { variant: variantParam } = await searchParams;
  const variant = resolveVariant(variantParam);

  return (
    <div className="flex flex-1 flex-col">
      {variant === "a" && <AccountA variant={variant} />}
      {variant === "b" && <AccountB variant={variant} />}
      {variant === "c" && <AccountC />}
      <VariantSwitcher />
    </div>
  );
}
