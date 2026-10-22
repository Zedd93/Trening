"use client";

import { useEffect, useRef, useState } from "react";
import { Notice } from "../ui";

interface Detector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

/**
 * Skaner kodów kreskowych z wykorzystaniem natywnego BarcodeDetector
 * (Chrome/Edge na Androidzie i komputerach). W pozostałych przeglądarkach
 * należy wpisać kod ręcznie. Obraz z kamery nie opuszcza urządzenia.
 */
export function BarcodeScanner({ onDetected }: { onDetected: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    if (!BD) {
      setError("Ta przeglądarka nie obsługuje skanowania kodów. Wpisz kod ręcznie.");
      return;
    }
    const detector = new BD({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const tick = async () => {
          if (stopped || !video.current) return;
          try {
            const codes = await detector.detect(video.current);
            if (codes[0]?.rawValue) {
              onDetected(codes[0].rawValue);
              return;
            }
          } catch {
            /* klatka nieczytelna */
          }
          raf = requestAnimationFrame(() => void tick());
        };
        void tick();
      } catch {
        setError("Brak dostępu do aparatu. Zezwól na użycie kamery lub wpisz kod ręcznie.");
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onDetected]);

  if (error) return <Notice tone="warn">{error}</Notice>;
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <video ref={video} className="aspect-video w-full bg-black object-cover" muted playsInline aria-label="Podgląd aparatu do skanowania kodu" />
    </div>
  );
}
