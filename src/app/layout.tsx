import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: { default: "SEAL PERFORMANCE", template: "%s · SEAL PERFORMANCE" },
  description: "Trening siłowy, kondycja i żywienie sportowe w jednej aplikacji. Program 4-tygodniowy Full Body z progresją i dietą dopasowaną do celu.",
  applicationName: "SEAL PERFORMANCE",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "SEAL PERF", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }, { url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: "/icons/apple-touch-icon.png",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0e100f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Motyw ustawiany przed renderem, aby uniknąć mignięcia.
const themeScript = `try{var t=localStorage.getItem('seal-theme');if(t==='light')document.documentElement.dataset.theme='light'}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
