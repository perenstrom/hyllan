// The retail symbologies batch scanning asks the decoder for (PER-276):
// everything a grocery pack realistically carries.
export const BARCODE_SYMBOLOGIES = ["ean_13", "upc_a", "ean_8"] as const;

export type BarcodeSymbology = (typeof BARCODE_SYMBOLOGIES)[number];

export function isBarcodeSymbology(value: string): value is BarcodeSymbology {
  return (BARCODE_SYMBOLOGIES as readonly string[]).includes(value);
}

const DIGIT_COUNT: Record<BarcodeSymbology, number> = {
  ean_13: 13,
  upc_a: 12,
  ean_8: 8,
};

// GS1 mod-10: weights alternate 3, 1 leftward from the digit just before
// the check digit, so the same rule covers EAN-13, UPC-A and EAN-8.
function hasValidCheckDigit(digits: string) {
  let sum = 0;
  for (let index = digits.length - 2; index >= 0; index--) {
    const weight = (digits.length - 2 - index) % 2 === 0 ? 3 : 1;
    sum += Number(digits[index]) * weight;
  }
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1]);
}

// The value a Barcode registration is stored and looked up under (ADR
// 0007): UPC-A zero-padded into the EAN-13 it's equivalent to, EAN-8 kept
// as its own value. Null for anything that isn't a well-formed code of the
// claimed symbology — the client's decoder already checks this, but the
// value reaches the server as plain input.
export function canonicalBarcodeValue(
  rawValue: string,
  symbology: BarcodeSymbology,
): string | null {
  const value = rawValue.trim();
  if (!/^\d+$/.test(value) || value.length !== DIGIT_COUNT[symbology]) {
    return null;
  }
  if (!hasValidCheckDigit(value)) {
    return null;
  }
  return symbology === "upc_a" ? `0${value}` : value;
}

// The digits as printed on the package: a UPC-A registration loses the
// leading zero canonicalization padded it with, everything else is stored
// as printed already.
export function displayBarcodeValue(
  canonicalValue: string,
  symbology: BarcodeSymbology,
): string {
  return symbology === "upc_a" ? canonicalValue.slice(1) : canonicalValue;
}

// For a value that comes back from the client already canonical (e.g. the
// barcode an unregistered scan reported, now being registered): canonical
// values are exactly the valid EAN-13s and EAN-8s.
export function isCanonicalBarcodeValue(value: string): boolean {
  const symbology = value.length === 8 ? "ean_8" : "ean_13";
  return canonicalBarcodeValue(value, symbology) === value;
}

// A decoded scan as the batch-entry page carries it between server calls:
// the canonical value plus the symbology it was read as.
export type ScannedBarcode = {
  value: string;
  symbology: BarcodeSymbology;
};
