"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  GalleryHorizontalEnd,
  LogOut,
  Menu,
  Palette,
  Settings,
  UserRoundPlus,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";
import { useMobile } from "@/components/mobile/MobileProvider";
import MobileBottomBar from "@/components/mobile/MobileBottomBar";
import "@/styles/mobile-shell.css";

type MobileShellProps = {
  children: React.ReactNode;
};

const drawerLinks = [
  { href: "/people", label: "Persoane", icon: UsersRound },
  { href: "/friends", label: "Prieteni", icon: Users },
  { href: "/requests", label: "Cereri", icon: UserRoundPlus },
  { href: "/groups", label: "Grupuri", icon: UsersRound },
  { href: "/gallery", label: "Galerie", icon: GalleryHorizontalEnd },
  { href: "/appearance", label: "Aspect", icon: Palette },
  { href: "/settings", label: "Setări", icon: Settings },
];

export default function MobileShell({ children }: MobileShellProps) {
  const { isMobile } = useMobile();
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMobile || !drawerOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen, isMobile]);

  async function handleLogout() {
    setDrawerOpen(false);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

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
              title="Notificări"
            >
              <Bell size={21} />
            </Link>

            <button
              type="button"
              className="friends-mobile-header-button"
              aria-label={drawerOpen ? "Închide meniul" : "Deschide meniul"}
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen((current) => !current)}
            >
              {drawerOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </header>
      )}

      <main
        className={
          isMobile ? "friends-mobile-content" : "friends-desktop-content"
        }
      >
        {children}
      </main>

      {isMobile && <MobileBottomBar />}

      {isMobile && drawerOpen && (
        <div className="friends-native-drawer-layer" role="presentation">
          <button
            type="button"
            className="friends-native-drawer-backdrop"
            aria-label="Închide meniul"
            onClick={() => setDrawerOpen(false)}
          />

          <div
            className="friends-native-drawer-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Meniu Friends"
          >
            <div className="friends-native-drawer-head">
              <div>
                <span className="friends-native-drawer-kicker">FRIENDS MOBILE</span>
                <strong>Meniu</strong>
              </div>

              <button
                type="button"
                className="friends-native-drawer-close"
                aria-label="Închide meniul"
                onClick={() => setDrawerOpen(false)}
              >
                <X size={22} />
              </button>
            </div>

            <nav className="friends-native-drawer-links">
              {drawerLinks.map((link) => {
                const Icon = link.icon;
                const active =
                  pathname === link.href ||
                  pathname.startsWith(`${link.href}/`);

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`friends-native-drawer-link ${
                      active ? "is-active" : ""
                    }`}
                  >
                    <Icon size={21} />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>

            <button
              type="button"
              className="friends-native-drawer-logout"
              onClick={() => void handleLogout()}
            >
              <LogOut size={21} />
              <span>Deconectare</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}