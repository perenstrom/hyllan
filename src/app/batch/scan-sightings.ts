// The decoder reads the same pack many times a second while it's held in
// front of the camera, but that's one scan, not dozens. A barcode counts
// when it's first seen, and again only after it's been out of frame for
// `gapMs` — move the pack away and back to scan another of the same.
export function createScanSightings(gapMs: number) {
  const lastSeen = new Map<string, number>();

  // Records a sighting without counting it — for frames read while the
  // page isn't accepting scans (e.g. the pick-or-create panel is open), so
  // the pack still in frame isn't counted again the moment it closes.
  function trackWithoutCounting(value: string, now: number) {
    lastSeen.set(value, now);
  }

  // Records a sighting and says whether it counts as a new scan.
  function countsAsNewScan(value: string, now: number) {
    const previous = lastSeen.get(value);
    trackWithoutCounting(value, now);
    return previous === undefined || now - previous > gapMs;
  }

  return { trackWithoutCounting, countsAsNewScan };
}
