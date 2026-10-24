import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SEAL PERFORMANCE",
    short_name: "SEAL PERF",
    description: "Trening siłowy, kondycja i żywienie sportowe — program 4-tygodniowy z progresją i dietą.",
    lang: "pl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0c0b",
    theme_color: "#0a0c0b",
    categories: ["health", "fitness", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "Dzisiejszy trening", url: "/trening", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Dodaj posiłek", url: "/dieta?dodaj=1", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
