import { describe, expect, it } from "vitest";

import { createScanSightings } from "./scan-sightings";

describe("createScanSightings", () => {
  it("counts the first sighting of a barcode", () => {
    const sightings = createScanSightings(1500);
    expect(sightings.countsAsNewScan("123", 0)).toBe(true);
  });

  it("ignores the same barcode while it stays in frame", () => {
    const sightings = createScanSightings(1500);
    sightings.countsAsNewScan("123", 0);

    expect(sightings.countsAsNewScan("123", 1000)).toBe(false);
    expect(sightings.countsAsNewScan("123", 2000)).toBe(false);
    expect(sightings.countsAsNewScan("123", 3000)).toBe(false);
  });

  it("counts the same barcode again once it's been out of frame for the gap", () => {
    const sightings = createScanSightings(1500);
    sightings.countsAsNewScan("123", 0);

    expect(sightings.countsAsNewScan("123", 1600)).toBe(true);
  });

  it("counts a different barcode straight away", () => {
    const sightings = createScanSightings(1500);
    sightings.countsAsNewScan("123", 0);

    expect(sightings.countsAsNewScan("456", 100)).toBe(true);
  });

  it("keeps tracking a barcode that was only noted, not counted, so it isn't counted on resume", () => {
    const sightings = createScanSightings(1500);
    sightings.countsAsNewScan("123", 0);
    sightings.trackWithoutCounting("123", 5000);

    expect(sightings.countsAsNewScan("123", 5500)).toBe(false);
  });
});
