"use client";

import { useEffect, useRef, useState } from "react";

type DetectedBarcode = { rawValue: string };
type Detector = { detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]> };

const FORMATS = [
  "qr_code",
  "code_128",
  "code_39",
  "code_93",
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "itf",
  "data_matrix",
  "pdf417",
  "codabar",
];

/** Built-in detector (Android Chrome) when it reads barcodes; otherwise the zxing ponyfill. */
async function createDetector(): Promise<Detector> {
  const Native = (globalThis as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> } }).BarcodeDetector;
  if (Native) {
    const supported = await Native.getSupportedFormats().catch(() => [] as string[]);
    const formats = FORMATS.filter((f) => supported.includes(f));
    if (formats.length > 0) return new Native({ formats });
  }
  const { BarcodeDetector } = await import("barcode-detector/ponyfill");
  return new BarcodeDetector({ formats: FORMATS as never[] }) as unknown as Detector;
}

/**
 * Live rear-camera preview that reports the first code it reads, then pauses until
 * `active` turns true again.
 */
export function CameraScanner({
  active,
  onDetected,
}: {
  active: boolean;
  onDetected: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectedRef = useRef(onDetected);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    async function start() {
      setStarting(true);
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser can't open the camera here. Use https and Chrome, or type the code below.");
        setStarting(false);
        return;
      }
      try {
        const [media, detector] = await Promise.all([
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          }),
          createDetector(),
        ]);
        if (stopped) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = media;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = media;
        await video.play().catch(() => undefined);
        setStarting(false);

        const tick = async () => {
          if (stopped) return;
          if (video.readyState >= 2) {
            const found = await detector.detect(video).catch(() => [] as DetectedBarcode[]);
            const value = found.find((b) => b.rawValue?.trim())?.rawValue;
            if (value && !stopped) {
              navigator.vibrate?.(80);
              onDetectedRef.current(value);
              return;
            }
          }
          timer = setTimeout(() => void tick(), 200);
        };
        void tick();
      } catch (e) {
        const name = e instanceof DOMException ? e.name : "";
        setError(
          name === "NotAllowedError"
            ? "Camera permission was blocked. Allow camera access for this site in the browser settings, or type the code below."
            : name === "NotFoundError"
              ? "No camera found on this device. Type the code below."
              : "Could not start the camera. Type the code below."
        );
        setStarting(false);
      }
    }

    void start();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active]);

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-black">
      <video ref={videoRef} className="h-full w-full object-cover" muted playsInline aria-label="Camera preview" />
      {active && !error ? (
        <div className="pointer-events-none absolute inset-[18%] rounded-lg border-2 border-white/80" aria-hidden />
      ) : null}
      {starting && active && !error ? (
        <p className="absolute inset-x-0 bottom-3 text-center text-sm text-white/90">Starting camera…</p>
      ) : null}
      {!active ? (
        <p className="absolute inset-0 flex items-center justify-center bg-black/60 px-6 text-center text-sm text-white">
          Paused
        </p>
      ) : null}
      {error ? (
        <p className="absolute inset-0 flex items-center justify-center bg-black/80 px-6 text-center text-sm text-white" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
