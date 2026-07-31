import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import ThemeLoader from "@/components/ThemeLoader";
import AppBackground from "@/components/AppBackground";
import "./globals.css";

export const metadata: Metadata = {
  title: "Friends",
  description: "Conectează-te. Distribuie. Fii împreună.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro" suppressHydrationWarning>
      <body>
        <ThemeLoader />
        <AppBackground />
        <Navbar />
        {children}
      </body>
    </html>
  );
}
