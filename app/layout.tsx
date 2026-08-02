import type { Metadata, Viewport } from "next";
import ThemeLoader from "@/components/ThemeLoader";
import AppBackground from "@/components/AppBackground";
import PWARegister from "@/components/pwa/PWARegister";
import { MobileProvider } from "@/components/mobile/MobileProvider";
import MobileShell from "@/components/mobile/MobileShell";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Friends",
    template: "%s | Friends",
  },
  description: "Conectează-te. Distribuie. Fii împreună.",
  applicationName: "Friends",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Friends",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      {
        url: "/icons/friends-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icons/friends-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a5c4b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
   <html lang="ro" suppressHydrationWarning>
  <body>
  <MobileProvider>
    <ThemeLoader />
    <PWARegister />
    <AppBackground />

    <MobileShell>
      {children}
    </MobileShell>
  </MobileProvider>
</body>
</html>
  );
}