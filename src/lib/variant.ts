// PROTOTYPE variant plumbing (PER-218) — throwaway, not part of the real app.

export type VariantKey = "a" | "b" | "c";

export const VARIANTS: { key: VariantKey; label: string }[] = [
  { key: "a", label: "Dense operator table" },
  { key: "b", label: "Card grid + modal" },
  { key: "c", label: "Mobile-first + FAB" },
];

export function resolveVariant(value: string | string[] | undefined): VariantKey {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "b" || v === "c" ? v : "a";
}

export function hrefWithVariant(path: string, variant: VariantKey): string {
  return `${path}?variant=${variant}`;
}
