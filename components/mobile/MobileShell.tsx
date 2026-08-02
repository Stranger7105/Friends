"use client";

import Link from "next/link";
import { Bell, Menu } from "lucide-react";
import Navbar from "@/components/Navbar";
import { useMobile } from "@/components/mobile/MobileProvider";
import MobileBottomBar from "@/components/mobile/MobileBottomBar";
import "@/styles/mobile-shell.css";

type MobileShellProps = {
  children: React.ReactNode;
};

export default function MobileShell({
  children,
}: MobileShellProps) {
  const { isMobile } = useMobile();

  /*
   * Navbar rămâne permanent montat deoarece gestionează:
   * - notificările în timp real;
   * - apelurile globale;
   * - invitațiile la conferințe;
   * - GlobalCallOverlay.
   *
   * Pe telefon ascundem doar partea vizuală prin CSS.
   */
  return (
    <>
      <div className={isMobile ? "friends-mobile-hidden-navbar" : ""}>
        <Navbar />
      </div>

      {isMobile && (
        <header className="friends-mobile-header">
          <Link href="/feed" className="friends-mobile-brand">
            <span className="friends-mobile-logo" aria-hidden="true">
              <span />
            </span>

            <span>Friends</span>
          </Link>

          <div className="friends-mobile-header-actions">
            <Link
              href="/notifications"
              className="friends-mobile-header-button"
              aria-label="Notificări"
            >
              <Bell size={21} />
            </Link>

            <Link
              href="/settings"
              className="friends-mobile-header-button"
              aria-label="Setări"
            >
              <Menu size={22} />
            </Link>
          </div>
        </header>
      )}

      <main
        className={
          isMobile
            ? "friends-mobile-content"
            : "friends-desktop-content"
        }
      >
        {children}
      </main>

      {isMobile && <MobileBottomBar />}
    </>
  );
}