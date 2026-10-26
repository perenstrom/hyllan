import { describe, expect, it } from "vitest";

import {
  canonicalBarcodeValue,
  isBarcodeSymbology,
  isCanonicalBarcodeValue,
} from "./barcode";

describe("isBarcodeSymbology", () => {
  it.each(["ean_13", "upc_a", "ean_8"])("accepts %s", (symbology) => {
    expect(isBarcodeSymbology(symbology)).toBe(true);
  });

  it("rejects symbologies batch scanning doesn't request", () => {
    expect(isBarcodeSymbology("qr_code")).toBe(false);
    expect(isBarcodeSymbology("upc_e")).toBe(false);
  });
});

describe("canonicalBarcodeValue", () => {
  it("keeps a valid EAN-13 as-is", () => {
    expect(canonicalBarcodeValue("7310865004703", "ean_13")).toBe(
      "7310865004703",
    );
  });

  it("zero-pads UPC-A to its equivalent EAN-13 (ADR 0007)", () => {
    expect(canonicalBarcodeValue("036000291452", "upc_a")).toBe(
      "0036000291452",
    );
  });

  it("lands UPC-A and its EAN-13 reading of the same product on one value", () => {
    expect(canonicalBarcodeValue("036000291452", "upc_a")).toBe(
      canonicalBarcodeValue("0036000291452", "ean_13"),
    );
  });

  it("keeps EAN-8 distinct rather than padding it into EAN-13", () => {
    expect(canonicalBarcodeValue("96385074", "ean_8")).toBe("96385074");
  });

  it("trims incidental whitespace", () => {
    expect(canonicalBarcodeValue(" 96385074\n", "ean_8")).toBe("96385074");
  });

  it.each([
    ["wrong length for EAN-13", "731086500470", "ean_13"],
    ["wrong length for UPC-A", "0036000291452", "upc_a"],
    ["wrong length for EAN-8", "963850744", "ean_8"],
    ["non-digits", "73108650047O3", "ean_13"],
    ["a bad EAN-13 check digit", "7310865004704", "ean_13"],
    ["a bad UPC-A check digit", "036000291453", "upc_a"],
    ["a bad EAN-8 check digit", "96385075", "ean_8"],
  ] as const)("rejects %s", (_, value, symbology) => {
    expect(canonicalBarcodeValue(value, symbology)).toBeNull();
  });
});

describe("isCanonicalBarcodeValue", () => {
  it("accepts the canonical forms canonicalBarcodeValue produces", () => {
    expect(isCanonicalBarcodeValue("7310865004703")).toBe(true);
    expect(isCanonicalBarcodeValue("0036000291452")).toBe(true);
    expect(isCanonicalBarcodeValue("96385074")).toBe(true);
  });

  it("rejects a raw UPC-A, which is only canonical once padded", () => {
    expect(isCanonicalBarcodeValue("036000291452")).toBe(false);
  });

  it("rejects a bad check digit", () => {
    expect(isCanonicalBarcodeValue("7310865004704")).toBe(false);
  });
});
