import { describe, expect, it } from "vitest";

import {
  activeBuckets,
  bucketKey,
  involvedLocationKeys,
  isDefaultLocationFilter,
  isMultiLocation,
  normalizeLocationName,
  UNASSIGNED_KEY,
  visibleActiveBuckets,
  type PantryItemBucket,
} from "./location";

const PANTRY_LOCATION_ID = "11111111-1111-1111-1111-111111111111";
const GARAGE_LOCATION_ID = "22222222-2222-2222-2222-222222222222";

function bucket(overrides: Partial<PantryItemBucket> = {}): PantryItemBucket {
  return {
    locationId: null,
    locationName: null,
    quantity: "0",
    ...overrides,
  };
}

describe("normalizeLocationName", () => {
  it("lowercases the name", () => {
    expect(normalizeLocationName("Pantry")).toBe("pantry");
  });

  it("trims incidental whitespace", () => {
    expect(normalizeLocationName("  Pantry  ")).toBe("pantry");
  });
});

describe("bucketKey", () => {
  it("returns the location id when set", () => {
    expect(bucketKey({ locationId: PANTRY_LOCATION_ID })).toBe(
      PANTRY_LOCATION_ID,
    );
  });

  it("returns the unassigned sentinel when the location id is null", () => {
    expect(bucketKey({ locationId: null })).toBe(UNASSIGNED_KEY);
  });
});

describe("activeBuckets", () => {
  it("keeps only buckets with positive quantity, unassigned last", () => {
    const buckets = [
      bucket({ locationId: null, quantity: "1" }),
      bucket({ locationId: PANTRY_LOCATION_ID, quantity: "2" }),
      bucket({ locationId: GARAGE_LOCATION_ID, quantity: "0" }),
    ];

    expect(activeBuckets(buckets)).toEqual([
      bucket({ locationId: PANTRY_LOCATION_ID, quantity: "2" }),
      bucket({ locationId: null, quantity: "1" }),
    ]);
  });

  it("falls back to the actual unassigned row when nothing is positive", () => {
    const buckets = [
      bucket({ locationId: null, quantity: "0" }),
      bucket({ locationId: PANTRY_LOCATION_ID, quantity: "0" }),
    ];

    expect(activeBuckets(buckets)).toEqual([
      bucket({ locationId: null, quantity: "0" }),
    ]);
  });

  it("falls back to a zero placeholder when there is no unassigned row at all", () => {
    const buckets = [bucket({ locationId: PANTRY_LOCATION_ID, quantity: "0" })];

    expect(activeBuckets(buckets)).toEqual([
      { locationId: null, locationName: null, quantity: "0" },
    ]);
  });
});

describe("isMultiLocation", () => {
  it("is false for a single positive bucket", () => {
    expect(
      isMultiLocation([
        bucket({ locationId: PANTRY_LOCATION_ID, quantity: "2" }),
      ]),
    ).toBe(false);
  });

  it("is false when everything sits in Unassigned", () => {
    expect(isMultiLocation([bucket({ locationId: null, quantity: "2" })])).toBe(
      false,
    );
  });

  it("is false for a fully zeroed item", () => {
    expect(isMultiLocation([bucket({ locationId: null, quantity: "0" })])).toBe(
      false,
    );
  });

  it("is true once more than one bucket holds quantity", () => {
    expect(
      isMultiLocation([
        bucket({ locationId: PANTRY_LOCATION_ID, quantity: "1" }),
        bucket({ locationId: null, quantity: "1" }),
      ]),
    ).toBe(true);
  });
});

describe("involvedLocationKeys", () => {
  it("lists the keys of every active bucket", () => {
    const buckets = [
      bucket({ locationId: PANTRY_LOCATION_ID, quantity: "1" }),
      bucket({ locationId: null, quantity: "1" }),
    ];

    expect(involvedLocationKeys(buckets)).toEqual([
      PANTRY_LOCATION_ID,
      UNASSIGNED_KEY,
    ]);
  });
});

describe("visibleActiveBuckets", () => {
  it("filters out hidden buckets without affecting the others", () => {
    const buckets = [
      bucket({ locationId: PANTRY_LOCATION_ID, quantity: "1" }),
      bucket({ locationId: GARAGE_LOCATION_ID, quantity: "2" }),
    ];

    expect(
      visibleActiveBuckets(buckets, new Set([GARAGE_LOCATION_ID])),
    ).toEqual([bucket({ locationId: PANTRY_LOCATION_ID, quantity: "1" })]);
  });
});

describe("isDefaultLocationFilter", () => {
  it("is true when nothing is hidden", () => {
    expect(isDefaultLocationFilter(new Set())).toBe(true);
  });

  it("is false once anything is hidden", () => {
    expect(isDefaultLocationFilter(new Set([UNASSIGNED_KEY]))).toBe(false);
  });
});
