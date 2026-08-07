"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Clapperboard,
  Home,
  Image as GalleryIcon,
  LogOut,
  Menu,
  MessageCircle,
  MapPinned,
  PhoneCall,
  Palette,
  Search,
  Settings,
  User,
  UserRoundPlus,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import GlobalCallLauncher from "@/components/calls/GlobalCallLauncher";
import GlobalCallOverlay from "@/components/calls/GlobalCallOverlay";
import { useGlobalCallManager } from "@/components/calls/useGlobalCallManager";
import useCall from "@/components/calls/useCall";
import {
  FRIENDS_START_CALL_EVENT,
  FRIENDS_START_CONFERENCE_EVENT,
  type GlobalCallRequest,
  type GlobalConferenceRequest,
} from "@/components/calls/globalCallEvents";
import "@/styles/navbar-theme.css";
import "@/styles/friends-real-calls.css";
import "@/styles/friends-groups.css";
import { FRIENDS_NOTIFICATIONS_CHANGED } from "@/lib/notificationEvents";

const navigationLinks = [
  { href: "/feed", label: "Feed", icon: Home },
  { href: "/reels", label: "Reels", icon: Clapperboard },
  { href: "/people", label: "Persoane", icon: UsersRound },
  { href: "/friends", label: "Prieteni", icon: Users },
  { href: "/groups", label: "Grupuri", icon: UsersRound },
  { href: "/requests", label: "Cereri", icon: UserRoundPlus },
  { href: "/gallery", label: "Galerie", icon: GalleryIcon },
  { href: "/appearance", label: "Aspect", icon: Palette },
  { href: "/settings", label: "Setări", icon: Settings },
];

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const [userId, setUserId] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [messagePulse, setMessagePulse] = useState(false);
  const [callCenterOpen, setCallCenterOpen] = useState(false);
  const previousUnreadMessageCountRef = useRef(0);
  const callManager = useGlobalCallManager(userId);
  const persistentCalls = useCall();

  useEffect(() => {
    function handleGlobalCallRequest(event: Event) {
      const request = (event as CustomEvent<GlobalCallRequest>).detail;

      if (
        !request?.contact?.id ||
        !Number.isFinite(request.conversationId) ||
        request.conversationId <= 0
      ) {
        console.error("Cererea de apel din conversație este incompletă.");
        return;
      }

      void callManager.startCall(request);
    }

    window.addEventListener(
      FRIENDS_START_CALL_EVENT,
      handleGlobalCallRequest as EventListener,
    );

    return () => {
      window.removeEventListener(
        FRIENDS_START_CALL_EVENT,
        handleGlobalCallRequest as EventListener,
      );
    };
  }, [callManager.startCall]);

  useEffect(() => {
    function handleGlobalConferenceRequest(event: Event) {
      const request = (event as CustomEvent<GlobalConferenceRequest>).detail;

      if (
        !request ||
        !Number.isFinite(request.conversationId) ||
        request.conversationId <= 0 ||
        request.invitees.length === 0
      ) {
        console.error("Cererea de apel de grup este incompletă.");
        return;
      }

      void callManager.startConference(request);
    }

    window.addEventListener(
      FRIENDS_START_CONFERENCE_EVENT,
      handleGlobalConferenceRequest as EventListener,
    );

    return () => {
      window.removeEventListener(
        FRIENDS_START_CONFERENCE_EVENT,
        handleGlobalConferenceRequest as EventListener,
      );
    };
  }, [callManager.startConference]);


  const loadUnreadCount = useCallback(async (id: string) => {
    const [allResult, messageResult] = await Promise.all([
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", id)
        .eq("is_read", false),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", id)
        .eq("type", "message")
        .eq("is_read", false),
    ]);

    if (!allResult.error) setUnreadCount(allResult.count ?? 0);
    if (!messageResult.error) setUnreadMessageCount(messageResult.count ?? 0);
  }, []);

  useEffect(() => {
    let active = true;

    async function initialize() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active || !user) return;
      setUserId(user.id);
      await loadUnreadCount(user.id);
    }

    void initialize();
    return () => { active = false; };
  }, [loadUnreadCount]);

  useEffect(() => {
    if (!userId) return;

    function refreshCounts() {
      void loadUnreadCount(userId);
    }

    window.addEventListener(
      FRIENDS_NOTIFICATIONS_CHANGED,
      refreshCounts
    );
    window.addEventListener("focus", refreshCounts);

    return () => {
      window.removeEventListener(
        FRIENDS_NOTIFICATIONS_CHANGED,
        refreshCounts
      );
      window.removeEventListener(
        "focus",
        refreshCounts
      );
    };
  }, [loadUnreadCount, userId]);

  useEffect(() => {
    if (userId) {
      void loadUnreadCount(userId);
    }
  }, [loadUnreadCount, pathname, userId]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`navbar-notifications-${userId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        () => void loadUnreadCount(userId)
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [loadUnreadCount, userId]);

  useEffect(() => {
    document.title = unreadMessageCount > 0
      ? `(${unreadMessageCount}) Friends`
      : "Friends";

    return () => { document.title = "Friends"; };
  }, [unreadMessageCount]);

  useEffect(() => {
    const previousCount = previousUnreadMessageCountRef.current;

    if (unreadMessageCount > previousCount) {
      setMessagePulse(true);
      const timeoutId = window.setTimeout(() => setMessagePulse(false), 1800);
      previousUnreadMessageCountRef.current = unreadMessageCount;
      return () => window.clearTimeout(timeoutId);
    }

    previousUnreadMessageCountRef.current = unreadMessageCount;
  }, [unreadMessageCount]);

  useEffect(() => {
    function handleOverlayChange(event: Event) {
      const customEvent = event as CustomEvent<{ open?: boolean }>;
      setOverlayOpen(Boolean(customEvent.detail?.open));
    }

    window.addEventListener("aurora-overlay-change", handleOverlayChange);
    return () => window.removeEventListener("aurora-overlay-change", handleOverlayChange);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string) {
    return pathname === href || (href !== "/feed" && pathname.startsWith(`${href}/`));
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const query = String(formData.get("query") ?? "").trim();
    if (!query) return;
    router.push(`/people?search=${encodeURIComponent(query)}`);
    setSearchOpen(false);
  }

  const navLink = (active: boolean) =>
    `friends-nav-link ${active ? "is-active" : ""}`;

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: overlayOpen ? 0 : 1, y: overlayOpen ? -110 : 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className={`friends-navbar-shell ${overlayOpen ? "is-overlay-open" : ""}`}
      >
        <div className="friends-navbar">
          <div className="friends-navbar-glow" aria-hidden="true" />
          <div className="friends-navbar-line" aria-hidden="true" />

          <div className="friends-navbar-row">
            <Link href="/feed" className="friends-brand">
              <motion.span
                whileHover={{ y: -2, rotate: -3, scale: 1.07 }}
                transition={{ type: "spring", stiffness: 420, damping: 24 }}
                className="friends-logo"
              >
                <span className="friends-logo-ring" />
                <span className="friends-logo-dot" />
              </motion.span>

              <span className="friends-brand-copy">
                <span className="friends-brand-name">Friends</span>
              </span>
            </Link>

            <nav className="friends-desktop-nav" aria-label="Navigare principală">
              {navigationLinks.map((link) => {
                const Icon = link.icon;
                const active = isActive(link.href);

                return (
                  <motion.div
                    key={link.href}
                    whileHover={{ y: -3, scale: 1.06 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 430, damping: 25 }}
                    className="friends-nav-motion"
                  >
                    <Link
                      href={link.href}
                      aria-label={link.label}
                      title={link.label}
                      className={navLink(active)}
                    >
                      <Icon size={19} strokeWidth={2.1} />
                      <span className="friends-nav-label">{link.label}</span>
                      {active && (
                        <motion.span
                          layoutId="friends-top-active"
                          className="friends-active-line"
                        />
                      )}
                    </Link>
                  </motion.div>
                );
              })}
            </nav>

            <div className="friends-navbar-actions">
              <motion.div
                animate={messagePulse ? { scale: [1, 1.08, 1], y: [0, -2, 0] } : { scale: 1, y: 0 }}
                transition={{ duration: 0.55, ease: "easeOut" }}
                whileHover={{ y: -3, scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className="friends-messages-wrap"
              >
                <Link
                  href="/messages"
                  aria-label={unreadMessageCount > 0 ? `Mesaje, ${unreadMessageCount} necitite` : "Mesaje"}
                  title="Mesaje"
                  className={`friends-messages-button ${
                    isActive("/messages") ? "is-active" : ""
                  } ${unreadMessageCount > 0 ? "has-unread" : ""}`}
                >
                  <span className="friends-button-shine" aria-hidden="true" />
                  <MessageCircle size={20} strokeWidth={2.35} />
                  <span className="friends-messages-label">Mesaje</span>

                  <AnimatePresence mode="popLayout">
                    {unreadMessageCount > 0 && (
                      <motion.span
                        key={unreadMessageCount}
                        initial={{ opacity: 0, scale: 0.55, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.55, y: 4 }}
                        className="friends-count-badge"
                      >
                        {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Link>
              </motion.div>

              <motion.div
                whileHover={{ y: -3, scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
              >
                <Link
                  href="/feed?map=1"
                  onClick={(event) => {
                    if (pathname === "/feed") {
                      event.preventDefault();
                      window.dispatchEvent(
                        new CustomEvent("friends:open-map")
                      );
                    }
                  }}
                  aria-label="Deschide Harta Friends"
                  title="Hartă"
                  className={`friends-messages-button ${
                    pathname === "/feed" ? "is-active" : ""
                  }`}
                  style={{
                    width: 42,
                    minWidth: 42,
                    height: 42,
                    padding: 0,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <span
                    className="friends-button-shine"
                    aria-hidden="true"
                  />
                  <MapPinned size={20} strokeWidth={2.35} />
                </Link>
              </motion.div>

              <motion.button
                type="button"
                whileHover={{ y: -3, scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setCallCenterOpen(true)}
                aria-label="Deschide centrul de apeluri"
                title="Apeluri"
                className="friends-messages-button friends-calls-button"
              >
                <span className="friends-button-shine" aria-hidden="true" />
                <PhoneCall size={20} strokeWidth={2.35} />
                <span className="friends-messages-label">Apeluri</span>
              </motion.button>

              <motion.button
                type="button"
                whileHover={{ y: -2, scale: 1.06 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSearchOpen((current) => !current)}
                aria-label="Căutare"
                title="Căutare"
                className={`friends-icon-button ${searchOpen ? "is-active" : ""}`}
              >
                {searchOpen ? <X size={20} /> : <Search size={20} />}
              </motion.button>

              <motion.div whileHover={{ y: -2, scale: 1.06 }} whileTap={{ scale: 0.95 }} className="friends-action-wrap">
                <Link
                  href="/notifications"
                  aria-label="Notificări"
                  title="Notificări"
                  className={`friends-icon-button ${isActive("/notifications") ? "is-active" : ""}`}
                >
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="friends-notification-badge">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </motion.span>
                  )}
                </Link>
              </motion.div>

              <motion.div whileHover={{ y: -2, scale: 1.06 }} whileTap={{ scale: 0.95 }} className="friends-profile-wrap">
                <Link
                  href="/profile"
                  aria-label="Profil"
                  title="Profil"
                  className={`friends-icon-button ${isActive("/profile") ? "is-active" : ""}`}
                >
                  <User size={20} />
                </Link>
              </motion.div>

              <motion.button
                type="button"
                whileHover={{ y: -2, scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setMobileMenuOpen((current) => !current)}
                aria-label="Meniu"
                title="Meniu"
                className="friends-icon-button friends-menu-button"
              >
                {mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
              </motion.button>

              <motion.button
                type="button"
                whileHover={{ y: -2, scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleLogout}
                aria-label="Deconectare"
                title="Deconectare"
                className="friends-logout-button"
              >
                <LogOut size={20} />
              </motion.button>
            </div>
          </div>

          <AnimatePresence>
            {searchOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="friends-search-panel"
              >
                <form onSubmit={handleSearchSubmit} className="friends-search-form">
                  <Search size={19} />
                  <input autoFocus name="query" placeholder="Caută persoane în Friends..." />
                  <button type="submit">Caută</button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.nav
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.22 }}
              className="friends-mobile-nav"
              aria-label="Meniu mobil"
            >
              <Link
                href="/messages"
                className={`friends-mobile-link friends-mobile-messages ${
                  isActive("/messages") ? "is-active" : ""
                } ${unreadMessageCount > 0 ? "has-unread" : ""}`}
              >
                <MessageCircle size={20} />
                <span>Mesaje</span>
                {unreadMessageCount > 0 && (
                  <span className="friends-mobile-badge">
                    {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
                  </span>
                )}
              </Link>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setCallCenterOpen(true);
                }}
                className="friends-mobile-link"
              >
                <PhoneCall size={20} />
                <span>Apeluri</span>
              </button>

              {navigationLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`friends-mobile-link ${isActive(link.href) ? "is-active" : ""}`}
                  >
                    <Icon size={19} />
                    <span>{link.label}</span>
                  </Link>
                );
              })}

              <Link
                href="/notifications"
                className={`friends-mobile-link ${isActive("/notifications") ? "is-active" : ""}`}
              >
                <Bell size={19} />
                <span>Notificări</span>
                {unreadCount > 0 && (
                  <span className="friends-mobile-badge">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>

              <Link
                href="/profile"
                className={`friends-mobile-link ${isActive("/profile") ? "is-active" : ""}`}
              >
                <User size={19} />
                <span>Profil</span>
              </Link>

              <button type="button" onClick={handleLogout} className="friends-mobile-logout">
                <LogOut size={19} />
                Deconectare
              </button>
            </motion.nav>
          )}
        </AnimatePresence>
      </motion.header>

      <div className="friends-navbar-spacer" aria-hidden="true" />

      <GlobalCallLauncher
        open={callCenterOpen}
        currentUserId={userId}
        onClose={() => setCallCenterOpen(false)}
        onStartPersonCall={async ({
          contact,
          conversationId,
        }) => {
          const started =
            await persistentCalls.startCall(
              {
                conversationId:
                  String(conversationId),
                userId: contact.id,
                fullName: contact.name,
                avatarUrl:
                  contact.avatarUrl ??
                  undefined,
              },
              "audio"
            );

          if (!started) {
            throw new Error(
              persistentCalls.error ||
                "Apelul nu a putut fi pornit."
            );
          }
        }}
      />

      <GlobalCallOverlay
        open={callManager.open}
        status={callManager.status}
        mode={callManager.mode}
        kind={callManager.kind}
        contact={callManager.contact}
        isIncoming={callManager.isIncoming}
        isMuted={callManager.isMuted}
        isCameraOff={callManager.isCameraOff}
        durationSeconds={callManager.durationSeconds}
        error={callManager.error}
        localStream={callManager.localStream}
        remoteStream={callManager.remoteStream}
        conferenceInvite={callManager.conferenceInvite}
        conferenceParticipants={callManager.conferenceParticipants}
        conferenceRemoteStreams={callManager.conferenceRemoteStreams}
        connectionQuality={callManager.connectionQuality}
        onAccept={() => void (callManager.mode === "conference" ? callManager.acceptConference() : callManager.acceptCall())}
        onReject={() => void (callManager.mode === "conference" ? callManager.rejectConference() : callManager.rejectCall())}
        onEnd={() => void callManager.endCall()}
        onToggleMute={callManager.toggleMute}
        onToggleCamera={callManager.toggleCamera}
      />
    </>
  );
}