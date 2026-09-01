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

// Callers only ever mount this component while the camera should be live —
// each variant conditionally renders it rather than toggling an `active`
// flag on a persistently-mounted instance — so requesting on mount and
// releasing on unmount is the whole lifecycle; no separate "idle" state to
// juggle inside the effect.
function useCameraPreview() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<CameraPermissionState>(
    typeof navigator !== "undefined" &&
      typeof navigator.mediaDevices?.getUserMedia === "function"
      ? "requesting"
      : "unsupported",
  );

  useEffect(() => {
    if (
      typeof navigator === "undefined" ||
      typeof navigator.mediaDevices?.getUserMedia !== "function"
    ) {
      return;
    }

    let stream: MediaStream | undefined;
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((mediaStream) => {
        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setState("granted");
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
  }, []);

  return { videoRef, state };
}

type Props = {
  className?: string;
  onSimulateScan: (kind: "known" | "unknown") => void;
};

export function BatchScanCamera({ className, onSimulateScan }: Props) {
  const { videoRef, state } = useCameraPreview();

  return (
    <div
      className={`relative overflow-hidden rounded bg-black ${className ?? ""}`}
    >
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
              Camera access denied — check your browser&apos;s site settings, or
              use manual entry below.
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
  );
}
