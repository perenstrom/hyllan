"use client";

import { useEffect, useRef, useState } from "react";

// PER-278 prototype infrastructure — a real getUserMedia call so camera
// permission states (the actual open question) show up as they really
// would, rather than being drawn from imagination. Decoding is stubbed:
// the research ticket (PER-276) already settled the `barcode-detector`
// ponyfill as the decoding approach, so wiring up real symbol detection
// here would just be re-proving that decision, not the layout question
// this prototype exists to answer. "Simulate scan" buttons fire the two
// decode outcomes (registered / unregistered) that the UI actually has to
// handle differently.
export type CameraPermissionState =
  "requesting" | "granted" | "denied" | "unsupported";

const DEVICE_STORAGE_KEY = "hyllan:batch-scan-camera-device";

function readStoredDeviceId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(DEVICE_STORAGE_KEY);
  } catch {
    return null;
  }
}

// Callers only ever mount this component while the camera should be live —
// each variant conditionally renders it rather than toggling an `active`
// flag on a persistently-mounted instance — so requesting on mount (or on
// a device change) and releasing on unmount/re-request is the lifecycle.
function useCameraPreview(deviceId: string | null) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<CameraPermissionState>(
    typeof navigator !== "undefined" &&
      typeof navigator.mediaDevices?.getUserMedia === "function"
      ? "requesting"
      : "unsupported",
  );
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  // The device actually streaming, read back from the granted track's own
  // settings — distinct from `deviceId` (the request), since a first grant
  // with no stored preference asks by `facingMode` and we only learn which
  // physical device answered after the fact.
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);

  useEffect(() => {
    if (
      typeof navigator === "undefined" ||
      typeof navigator.mediaDevices?.getUserMedia !== "function"
    ) {
      return;
    }

    let stream: MediaStream | undefined;
    let cancelled = false;

    const constraints: MediaStreamConstraints = {
      video: deviceId
        ? { deviceId: { exact: deviceId } }
        : { facingMode: "environment" },
    };

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then(async (mediaStream) => {
        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setState("granted");
        setActiveDeviceId(
          mediaStream.getVideoTracks()[0]?.getSettings().deviceId ?? null,
        );
        try {
          const allDevices = await navigator.mediaDevices.enumerateDevices();
          if (!cancelled) {
            setDevices(
              allDevices.filter((device) => device.kind === "videoinput"),
            );
          }
        } catch {
          // Device labels/list are a nice-to-have on top of the working
          // stream above — a failed enumerate isn't itself a failure.
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState("denied");
        }
      });

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [deviceId]);

  return { videoRef, state, devices, activeDeviceId };
}

type Props = {
  className?: string;
  onSimulateScan: (kind: "known" | "unknown") => void;
};

export function BatchScanCamera({ className, onSimulateScan }: Props) {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(() =>
    readStoredDeviceId(),
  );
  const { videoRef, state, devices, activeDeviceId } =
    useCameraPreview(selectedDeviceId);

  function handleDeviceChange(deviceId: string) {
    setSelectedDeviceId(deviceId);
    try {
      window.localStorage.setItem(DEVICE_STORAGE_KEY, deviceId);
    } catch {
      // Best-effort — a failed write just means the choice doesn't survive
      // a reload, not that switching the camera itself failed.
    }
  }

  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      {devices.length > 1 && (
        <select
          aria-label="Camera"
          value={selectedDeviceId ?? activeDeviceId ?? ""}
          onChange={(event) => handleDeviceChange(event.target.value)}
          className="h-9 w-full rounded border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {devices.map((device, index) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Camera ${index + 1}`}
            </option>
          ))}
        </select>
      )}
      <div className="relative h-48 w-full overflow-hidden rounded bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
        />
        {state !== "granted" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/85 px-4 text-center text-xs text-white">
            {state === "requesting" && <p>Requesting camera access…</p>}
            {state === "denied" && (
              <p>
                Camera access denied — check your browser&apos;s site settings,
                or use manual entry below.
              </p>
            )}
            {state === "unsupported" && (
              <p>
                Camera not available in this browser — use manual entry below.
              </p>
            )}
          </div>
        )}
        {state === "granted" && (
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-2 px-2">
            <button
              type="button"
              onClick={() => onSimulateScan("known")}
              className="rounded bg-white/90 px-2 py-1 text-xs font-medium text-black"
            >
              Simulate scan: known item
            </button>
            <button
              type="button"
              onClick={() => onSimulateScan("unknown")}
              className="rounded bg-white/90 px-2 py-1 text-xs font-medium text-black"
            >
              Simulate scan: new barcode
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
