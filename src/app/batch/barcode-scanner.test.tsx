import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The decoder's answer for the next frame; [] is a frame with no code.
let frame: { rawValue: string; format: string }[] = [];

vi.mock("barcode-detector/ponyfill", () => ({
  prepareZXingModule: vi.fn(),
  BarcodeDetector: class {
    async detect() {
      return frame;
    }
  },
}));

const { BarcodeScanner } = await import("./barcode-scanner");

const fakeStream = {
  getTracks: () => [{ stop: vi.fn() }],
  getVideoTracks: () => [{ getSettings: () => ({ deviceId: "rear" }) }],
};

beforeEach(() => {
  frame = [];
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn(async () => fakeStream),
      enumerateDevices: vi.fn(async () => []),
    },
  });
  // jsdom never loads media, so a video would otherwise sit at
  // HAVE_NOTHING and the decode loop would skip every frame.
  Object.defineProperty(HTMLMediaElement.prototype, "readyState", {
    configurable: true,
    get: () => 4,
  });
});

afterEach(() => {
  Reflect.deleteProperty(HTMLMediaElement.prototype, "readyState");
});

function preview() {
  return screen.getByLabelText("Camera preview").parentElement!;
}

describe("BarcodeScanner", () => {
  it("pulses the camera green when it counts a scan, then settles back", async () => {
    const onDetected = vi.fn();
    render(<BarcodeScanner paused={false} onDetected={onDetected} />);
    await waitFor(() =>
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled(),
    );
    expect(preview()).toHaveAttribute("data-scan-flash", "false");

    frame = [{ rawValue: "7310865004703", format: "ean_13" }];

    await waitFor(() =>
      expect(onDetected).toHaveBeenCalledWith("7310865004703", "ean_13"),
    );
    expect(preview()).toHaveAttribute("data-scan-flash", "true");

    frame = [];
    await waitFor(
      () => expect(preview()).toHaveAttribute("data-scan-flash", "false"),
      { timeout: 1500 },
    );
  });

  it("doesn't pulse for a frame read while paused", async () => {
    const onDetected = vi.fn();
    render(<BarcodeScanner paused onDetected={onDetected} />);
    frame = [{ rawValue: "7310865004703", format: "ean_13" }];

    // Long enough for several decode ticks.
    await new Promise((resolve) => setTimeout(resolve, 700));

    expect(onDetected).not.toHaveBeenCalled();
    expect(preview()).toHaveAttribute("data-scan-flash", "false");
  });
});
