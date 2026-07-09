import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { ServiceWorkerRegistrar } from "@/components/layout/ServiceWorkerRegistrar";

export const metadata: Metadata = {
  title: "Touchline — Football Manager Sim",
  description: "Offline-first football management simulation for personal use.",
  manifest: "/manifest.json",
  applicationName: "Touchline",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Touchline",
  },
};

export const viewport: Viewport = {
  themeColor: "#0F3D2E",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Loaded from Google Fonts at runtime in the user's browser; the
            sandbox that built this scaffold has no network access to verify
            it, so double-check rendering once you run `npm run dev`. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body>
        <ServiceWorkerRegistrar />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
