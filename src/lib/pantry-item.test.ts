import { describe, expect, it } from "vitest";

import {
  decrementQuantity,
  formatQuantity,
  incrementQuantity,
  isPantryItemUnit,
  normalizePantryItemName,
  parsePantryItemInput,
  parseQuantity,
} from "./pantry-item";

describe("isPantryItemUnit", () => {
  it.each(["count", "g", "kg", "ml", "l", "box", "bag", "pack"])(
    "accepts %s",
    (unit) => {
      expect(isPantryItemUnit(unit)).toBe(true);
    },
  );

  it("rejects a unit outside the fixed set", () => {
    expect(isPantryItemUnit("kilogram")).toBe(false);
    expect(isPantryItemUnit("")).toBe(false);
  });
});

describe("normalizePantryItemName", () => {
  it("lowercases the name", () => {
    expect(normalizePantryItemName("Rice")).toBe("rice");
  });

  it("trims incidental whitespace", () => {
    expect(normalizePantryItemName("  Rice  ")).toBe("rice");
  });

  it("treats different-case names as equal once normalized", () => {
    expect(normalizePantryItemName("RICE")).toBe(
      normalizePantryItemName("rice"),
    );
  });
});

describe("parseQuantity", () => {
  it("accepts a whole number", () => {
    expect(parseQuantity("5")).toBe("5");
  });

  it("accepts zero", () => {
    expect(parseQuantity("0")).toBe("0");
  });

  it("accepts a decimal", () => {
    expect(parseQuantity("2.5")).toBe("2.5");
  });

  it("trims surrounding whitespace", () => {
    expect(parseQuantity("  3  ")).toBe("3");
  });

  it("rejects a negative quantity", () => {
    expect(parseQuantity("-1")).toBeNull();
  });

  it("rejects non-numeric input", () => {
    expect(parseQuantity("abc")).toBeNull();
  });

  it("rejects an empty string", () => {
    expect(parseQuantity("")).toBeNull();
  });

  it("rejects a malformed decimal", () => {
    expect(parseQuantity("1.2.3")).toBeNull();
    expect(parseQuantity("1.")).toBeNull();
  });
});

describe("formatQuantity", () => {
  it("shows a plain number for the unit-less count default", () => {
    expect(formatQuantity("6", "count")).toBe("6");
  });

  it("postfixes the unit for every other unit", () => {
    expect(formatQuantity("2", "kg")).toBe("2 kg");
  });

  it("drops insignificant trailing zeros", () => {
    expect(formatQuantity("2.50", "kg")).toBe("2.5 kg");
  });

  it("formats zero", () => {
    expect(formatQuantity("0", "count")).toBe("0");
  });
});

describe("incrementQuantity", () => {
  it("adds one to a whole number", () => {
    expect(incrementQuantity("2")).toBe("3");
  });

  it("adds one to a decimal", () => {
    expect(incrementQuantity("2.5")).toBe("3.5");
  });
});

describe("decrementQuantity", () => {
  it("subtracts one from a whole number", () => {
    expect(decrementQuantity("2")).toBe("1");
  });

  it("subtracts one from a decimal", () => {
    expect(decrementQuantity("2.5")).toBe("1.5");
  });

  it("floors at zero rather than going negative", () => {
    expect(decrementQuantity("0")).toBe("0");
  });

  it("floors a fractional quantity below one at zero", () => {
    expect(decrementQuantity("0.5")).toBe("0");
  });
});

function formDataOf(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

describe("parsePantryItemInput", () => {
  it("parses a valid submission", () => {
    const result = parsePantryItemInput(
      formDataOf({ name: "Rice", quantity: "2", unit: "kg" }),
    );

    expect(result).toEqual({
      ok: true,
      value: { name: "Rice", quantity: "2", unit: "kg" },
    });
  });

  it("defaults unit to count when omitted", () => {
    const result = parsePantryItemInput(
      formDataOf({ name: "Eggs", quantity: "6" }),
    );

    expect(result).toEqual({
      ok: true,
      value: { name: "Eggs", quantity: "6", unit: "count" },
    });
  });

  it("trims the name", () => {
    const result = parsePantryItemInput(
      formDataOf({ name: "  Rice  ", quantity: "2" }),
    );

    expect(result.ok && result.value.name).toBe("Rice");
  });

  it("rejects a missing name", () => {
    const result = parsePantryItemInput(
      formDataOf({ name: "  ", quantity: "2" }),
    );

    expect(result).toEqual({ ok: false, error: "Name is required." });
  });

  it("rejects an invalid quantity", () => {
    const result = parsePantryItemInput(
      formDataOf({ name: "Rice", quantity: "-2" }),
    );

    expect(result).toEqual({
      ok: false,
      error: "Quantity must be zero or a positive number.",
    });
  });

  it("rejects a unit outside the fixed set", () => {
    const result = parsePantryItemInput(
      formDataOf({ name: "Rice", quantity: "2", unit: "kilogram" }),
    );

    expect(result).toEqual({ ok: false, error: "Choose a valid unit." });
  });
});
