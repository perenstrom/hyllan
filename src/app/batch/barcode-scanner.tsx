"use client";

import { useEffect, useRef, useState } from "react";

import { createScanSightings } from "./scan-sightings";
import { BARCODE_SYMBOLOGIES } from "@/lib/barcode";

type CameraState = "requesting" | "granted" | "denied" | "unsupported";

const DEVICE_STORAGE_KEY = "hyllan:batch-scan-camera-device";

// Decoding every animation frame pegs a phone's CPU for no gain — a few
// reads a second is plenty for a pack held still (PER-276 §6).
const DETECT_INTERVAL_MS = 250;
const RESCAN_GAP_MS = 1500;
// How long the green "got it" pulse holds before fading back out.
const SCAN_FLASH_MS = 400;

function readStoredDeviceId(): string | null {
  try {
    return window.localStorage.getItem(DEVICE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function cameraSupported() {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

type Detector = {
  detect: (
    source: HTMLVideoElement,
  ) => Promise<{ rawValue: string; format: string }[]>;
};

// The `barcode-detector` ponyfill (zxing-wasm) is the one decoding path on
// every browser, native BarcodeDetector or not (PER-276). Imported only
// once the camera is live so neither the module nor its ~1 MB WASM binary
// is part of the page's initial load, and the binary is served from this
// app rather than the package's default CDN.
async function loadDetector(): Promise<Detector> {
  const { BarcodeDetector, prepareZXingModule } =
    await import("barcode-detector/ponyfill");
  const wasmUrl = new URL(
    "zxing-wasm/reader/zxing_reader.wasm",
    import.meta.url,
  ).href;
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) =>
        path.endsWith(".wasm") ? wasmUrl : prefix + path,
    },
  });
  return new BarcodeDetector({ formats: [...BARCODE_SYMBOLOGIES] });
}

// Requests the camera on mount (or on a device change) and releases it on
// unmount — callers only mount the scanner while it should be live.
// `onStaleDevice` fires when the remembered camera can't be opened any
// more (unplugged, or the browser rotated its ids) — the caller forgets it,
// which re-requests by facingMode instead of reporting "denied" forever.
function useCamera(deviceId: string | null, onStaleDevice: () => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<CameraState>(
    cameraSupported() ? "requesting" : "unsupported",
  );
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  // The device actually streaming, read back from the granted track — a
  // first grant with no stored choice asks by facingMode, so which camera
  // answered is only known afterward.
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const onStaleDeviceRef = useRef(onStaleDevice);
  useEffect(() => {
    onStaleDeviceRef.current = onStaleDevice;
  });

  useEffect(() => {
    if (!cameraSupported()) {
      return;
    }

    let stream: MediaStream | undefined;
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: "environment" },
      })
      .then(async (granted) => {
        if (cancelled) {
          granted.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = granted;
        if (videoRef.current) {
          videoRef.current.srcObject = granted;
        }
        setState("granted");
        setActiveDeviceId(
          granted.getVideoTracks()[0]?.getSettings().deviceId ?? null,
        );
        try {
          const all = await navigator.mediaDevices.enumerateDevices();
          if (!cancelled) {
            setDevices(all.filter((device) => device.kind === "videoinput"));
          }
        } catch {
          // The picker is a nicety on top of a working stream.
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const name = error instanceof DOMException ? error.name : "";
        if (
          deviceId &&
          name !== "NotAllowedError" &&
          name !== "SecurityError"
        ) {
          onStaleDeviceRef.current();
          return;
        }
        setState("denied");
      });

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [deviceId]);

  return { videoRef, state, devices, activeDeviceId };
}

type Props = {
  // While true, frames are still read (so a pack left in view isn't
  // counted the moment scanning resumes) but nothing is reported.
  paused: boolean;
  onDetected: (rawValue: string, format: string) => void;
};

// The camera panel the item field's scan icon opens (prototyped in
// PER-278): live preview, a camera picker when there's more than one, and
// the decode loop.
export function BarcodeScanner({ paused, onDetected }: Props) {
  const [selectedDeviceId, setSelectedDeviceId] = useState(readStoredDeviceId);
  const { videoRef, state, devices, activeDeviceId } = useCamera(
    selectedDeviceId,
    forgetDevice,
  );
  const [decoderFailed, setDecoderFailed] = useState(false);
  // Confirms a read the instant it happens, on the camera itself where the
  // household is looking — the log entry only lands once the server
  // answers, and further down the page.
  const [flashing, setFlashing] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(flashTimer.current), []);

  // Read through refs so the decode loop isn't torn down and restarted
  // every time the page pauses or re-renders.
  const pausedRef = useRef(paused);
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    pausedRef.current = paused;
    onDetectedRef.current = onDetected;
  });

  useEffect(() => {
    if (state !== "granted") {
      return;
    }

    let cancelled = false;
    let busy = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const sightings = createScanSightings(RESCAN_GAP_MS);

    loadDetector()
      .then((detector) => {
        if (cancelled) {
          return;
        }
        timer = setInterval(async () => {
          const video = videoRef.current;
          if (busy || !video || video.readyState < video.HAVE_CURRENT_DATA) {
            return;
          }
          busy = true;
          try {
            const [found] = await detector.detect(video);
            if (!found || cancelled) {
              return;
            }
            const now = Date.now();
            if (pausedRef.current) {
              sightings.trackWithoutCounting(found.rawValue, now);
            } else if (sightings.countsAsNewScan(found.rawValue, now)) {
              navigator.vibrate?.(40);
              clearTimeout(flashTimer.current);
              setFlashing(true);
              flashTimer.current = setTimeout(
                () => setFlashing(false),
                SCAN_FLASH_MS,
              );
              onDetectedRef.current(found.rawValue, found.format);
            }
          } catch {
            // A frame that fails to decode is just a frame without a code.
          } finally {
            busy = false;
          }
        }, DETECT_INTERVAL_MS);
      })
      .catch(() => {
        if (!cancelled) {
          setDecoderFailed(true);
        }
      });

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [state, videoRef]);

  function forgetDevice() {
    setSelectedDeviceId(null);
    try {
      window.localStorage.removeItem(DEVICE_STORAGE_KEY);
    } catch {
      // Best-effort, same as saving it.
    }
  }

  function chooseDevice(deviceId: string) {
    setSelectedDeviceId(deviceId);
    try {
      window.localStorage.setItem(DEVICE_STORAGE_KEY, deviceId);
    } catch {
      // Best-effort: the choice just won't survive a reload.
    }
  }

  const message =
    state === "requesting"
      ? "Requesting camera access…"
      : state === "denied"
        ? "Camera access denied — check your browser's site settings, or type the item above."
        : state === "unsupported"
          ? "No camera available in this browser — type the item above."
          : decoderFailed
            ? "Barcode reading couldn't start — type the item above."
            : null;

  return (
    <div className="flex flex-col gap-2">
      {devices.length > 1 && (
        <select
          aria-label="Camera"
          value={selectedDeviceId ?? activeDeviceId ?? ""}
          onChange={(event) => chooseDevice(event.target.value)}
          className="h-11 w-full rounded border border-zinc-300 bg-white px-2 text-sm sm:h-9 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {devices.map((device, index) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Camera ${index + 1}`}
            </option>
          ))}
        </select>
      )}
      <div
        data-scan-flash={flashing}
        className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-black sm:aspect-auto sm:h-48"
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          aria-label="Camera preview"
          className="h-full w-full object-cover"
        />
        {/* A target band to aim the barcode at — purely visual. */}
        {state === "granted" && !decoderFailed && (
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-x-8 top-1/2 h-16 -translate-y-1/2 rounded border-2 motion-safe:transition-colors motion-safe:duration-300 ${
              flashing ? "border-emerald-400" : "border-white/70"
            }`}
          />
        )}
        {/* Drawn over the video rather than as the box's own border, so
            the pulse can't nudge the layout. Snaps on, fades off. */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 rounded-lg ring-4 ring-emerald-500 ring-inset ${
            flashing
              ? "opacity-100"
              : "opacity-0 motion-safe:transition-opacity motion-safe:duration-500"
          }`}
        />
        {message && (
          <p className="absolute inset-0 flex items-center justify-center bg-black/85 px-4 text-center text-sm text-white">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
