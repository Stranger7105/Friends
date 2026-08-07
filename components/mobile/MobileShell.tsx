"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  GalleryHorizontalEnd,
  LogOut,
  MapPinned,
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
import "@/styles/friends-notification-badges.css";
import { FRIENDS_NOTIFICATIONS_CHANGED } from "@/lib/notificationEvents";

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

const publicRoutes = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

export default function MobileShell({ children }: MobileShellProps) {
  const { isMobile } = useMobile();
  const pathname = usePathname();
  const isOpenConversation =
     pathname.startsWith("/messages/") &&
     pathname !== "/messages/messenger-demo";
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadFriendRequestCount, setUnreadFriendRequestCount] = useState(0);
  const mobileContentRef = useRef<HTMLElement | null>(null);

  const isPublicRoute = publicRoutes.some((route) => {
    if (route === "/") return pathname === "/";
    return pathname === route || pathname.startsWith(`${route}/`);
  });

  const loadCounts = useCallback(async (id: string) => {
    const [allResult, requestResult] = await Promise.all([
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", id)
        .eq("is_read", false),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", id)
        .eq("type", "friend_request")
        .eq("is_read", false),
    ]);

    if (!allResult.error) setUnreadCount(allResult.count ?? 0);
    if (!requestResult.error) {
      setUnreadFriendRequestCount(requestResult.count ?? 0);
    }
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isPublicRoute) {
      setUserId("");
      setUnreadCount(0);
      setUnreadFriendRequestCount(0);
      return;
    }

    let active = true;

    async function initialize() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active || !user) return;

      setUserId(user.id);
      await loadCounts(user.id);
    }

    void initialize();

    return () => {
      active = false;
    };
  }, [isPublicRoute, loadCounts]);

  useEffect(() => {
    if (!userId || isPublicRoute) return;

    function refreshCounts() {
      void loadCounts(userId);
    }

    window.addEventListener(
      FRIENDS_NOTIFICATIONS_CHANGED,
      refreshCounts
    );

    return () => {
      window.removeEventListener(
        FRIENDS_NOTIFICATIONS_CHANGED,
        refreshCounts
      );
    };
  }, [isPublicRoute, loadCounts, userId]);

  useEffect(() => {
    if (userId && !isPublicRoute) {
      void loadCounts(userId);
    }
  }, [isPublicRoute, loadCounts, pathname, userId]);

  useEffect(() => {
    if (!userId || isPublicRoute) return;

    const channel = supabase
      .channel(`mobile-shell-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        () => void loadCounts(userId)
      )
      .subscribe();

    const intervalId = window.setInterval(() => {
      void loadCounts(userId);
    }, 15000);

    function refreshOnFocus() {
      void loadCounts(userId);
    }

    window.addEventListener("focus", refreshOnFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshOnFocus);
      void supabase.removeChannel(channel);
    };
  }, [isPublicRoute, loadCounts, userId]);

  useEffect(() => {
    if (!isMobile || !drawerOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen, isMobile]);

  useEffect(() => {
    if (!isMobile || !isOpenConversation) return;

   const element = mobileContentRef.current;
if (!element) return;

function syncConversationViewport() {
  const viewport = window.visualViewport;

  const height = viewport?.height ?? window.innerHeight;
  const offsetTop = viewport?.offsetTop ?? 0;

  element?.style.setProperty(
    "--friends-conversation-viewport-height",
    `${Math.round(height)}px`
  );

  element?.style.setProperty(
    "--friends-conversation-viewport-top",
    `${Math.round(offsetTop)}px`
  );
}

syncConversationViewport();

    const viewport = window.visualViewport;

    viewport?.addEventListener("resize", syncConversationViewport);
    viewport?.addEventListener("scroll", syncConversationViewport);
    window.addEventListener("resize", syncConversationViewport);
    window.addEventListener("orientationchange", syncConversationViewport);

    const handleFocusChange = () => {
      window.setTimeout(syncConversationViewport, 30);
      window.setTimeout(syncConversationViewport, 180);
      window.setTimeout(syncConversationViewport, 420);
    };

    document.addEventListener("focusin", handleFocusChange);
    document.addEventListener("focusout", handleFocusChange);

    return () => {
      viewport?.removeEventListener("resize", syncConversationViewport);
      viewport?.removeEventListener("scroll", syncConversationViewport);
      window.removeEventListener("resize", syncConversationViewport);
      window.removeEventListener(
        "orientationchange",
        syncConversationViewport,
      );
      document.removeEventListener("focusin", handleFocusChange);
      document.removeEventListener("focusout", handleFocusChange);

      element.style.removeProperty(
        "--friends-conversation-viewport-height",
      );
      element.style.removeProperty(
        "--friends-conversation-viewport-top",
      );
    };
  }, [isMobile, isOpenConversation]);

  async function handleLogout() {
    setDrawerOpen(false);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (isPublicRoute) {
    return <>{children}</>;
  }

  return (
    <>
      <div className={isMobile ? "friends-mobile-hidden-navbar" : ""}>
        <Navbar />
      </div>

      {isMobile && !isOpenConversation && (
        <header className="friends-mobile-header">
          <Link href="/feed" className="friends-mobile-brand">
            <span className="friends-mobile-logo" aria-hidden="true">
              <span />
            </span>
            <span>Friends</span>
          </Link>

          <div className="friends-mobile-header-actions">
            <Link
              href="/map"
              className="friends-mobile-header-button"
              aria-label="Harta Friends"
              title="Hartă"
            >
              <MapPinned size={21} />
            </Link>

            <Link
              href="/notifications"
              className="friends-mobile-header-button friends-mobile-notification-button"
              aria-label={
                unreadCount > 0
                  ? `Notificări, ${unreadCount} necitite`
                  : "Notificări"
              }
              title="Notificări"
            >
              <Bell size={21} />

              {unreadCount > 0 && (
                <span className="friends-mobile-header-badge">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
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
        ref={mobileContentRef}
        className={
          isMobile
            ? `friends-mobile-content ${
                isOpenConversation
                  ? "friends-mobile-content--conversation"
                  : ""
              }`
            : "friends-desktop-content"
        }
      >
        {children}
      </main>

      {isMobile && !isOpenConversation && <MobileBottomBar />}
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
                <span className="friends-native-drawer-kicker">
                  FRIENDS MOBILE
                </span>
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

                    {link.href === "/requests" &&
                      unreadFriendRequestCount > 0 && (
                        <span className="friends-native-drawer-badge">
                          {unreadFriendRequestCount > 99
                            ? "99+"
                            : unreadFriendRequestCount}
                        </span>
                      )}
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
