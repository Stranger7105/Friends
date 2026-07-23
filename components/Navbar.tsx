"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  Home,
  LogOut,
  MessageCircle,
  User,
  UserRoundPlus,
  Users,
  UsersRound,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const links = [
  { href: "/feed", label: "Feed", icon: Home },
  { href: "/people", label: "Persoane", icon: UsersRound },
  { href: "/friends", label: "Prieteni", icon: Users },
  { href: "/requests", label: "Cereri", icon: UserRoundPlus },
  { href: "/messages", label: "Mesaje", icon: MessageCircle },
  { href: "/notifications", label: "Notificări", icon: Bell },
  { href: "/profile", label: "Profil", icon: User },
];

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const [userId, setUserId] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [hoveredDockIndex, setHoveredDockIndex] = useState<number | null>(null);

  const loadUnreadCount = useCallback(async (id: string) => {
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", id)
      .eq("is_read", false);

    if (!error) {
      setUnreadCount(count ?? 0);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function initialize() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active || !user) return;

      setUserId(user.id);
      await loadUnreadCount(user.id);
    }

    void initialize();

    return () => {
      active = false;
    };
  }, [loadUnreadCount]);

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
        () => {
          void loadUnreadCount(userId);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadUnreadCount, userId]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string) {
    return (
      pathname === href ||
      (href !== "/feed" && pathname.startsWith(`${href}/`))
    );
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/60 bg-white/42 shadow-[0_12px_45px_-34px_rgba(49,46,129,0.55)] backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1510px] items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href="/feed"
            className="group flex items-center gap-3"
          >
            <span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-2xl border border-white/80 bg-gradient-to-br from-emerald-700 via-emerald-500 to-lime-400 shadow-[0_15px_35px_-18px_rgba(0,168,107,0.9)] transition duration-300 group-hover:-translate-y-1 group-hover:scale-110">
              <span className="h-3 w-3 rounded-full bg-white/95 shadow-[0_0_18px_rgba(255,255,255,0.95)]" />
            </span>

            <span>
              <span className="block bg-gradient-to-r from-emerald-800 via-emerald-600 to-lime-600 bg-clip-text text-2xl font-black tracking-[-0.05em] text-transparent">
                Friends
              </span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Aurora Network
              </span>
            </span>
          </Link>

          <div className="hidden items-center gap-2 rounded-full border border-white/80 bg-white/55 px-3 py-2 text-xs font-bold text-slate-500 shadow-sm backdrop-blur-xl sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
            Conectat
          </div>
        </div>
      </header>

      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 hidden justify-center px-4 md:flex">
        <motion.nav
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="pointer-events-auto flex items-end gap-1 rounded-[30px] border border-white/20 bg-slate-950/72 px-3 py-2 shadow-[0_28px_85px_-28px_rgba(15,23,42,0.9)] backdrop-blur-2xl"
          aria-label="Navigare principală"
        >
          {links.map((link, index) => {
            const Icon = link.icon;
            const active = isActive(link.href);
            const distance =
              hoveredDockIndex === null
                ? 99
                : Math.abs(hoveredDockIndex - index);

            const dockScale =
              distance === 0 ? 1.24 : distance === 1 ? 1.1 : distance === 2 ? 1.035 : 1;

            const dockY =
              distance === 0 ? -11 : distance === 1 ? -5 : distance === 2 ? -2 : 0;

            return (
              <motion.div
                key={link.href}
                animate={{ y: dockY, scale: dockScale }}
                whileTap={{ scale: 0.93 }}
                transition={{ type: "spring", stiffness: 430, damping: 25 }}
                onMouseEnter={() => setHoveredDockIndex(index)}
                onMouseLeave={() => setHoveredDockIndex(null)}
                className="relative origin-bottom"
              >
                <Link
                  href={link.href}
                  aria-label={link.label}
                  title={link.label}
                  className={`group relative flex h-14 w-14 items-center justify-center rounded-2xl border transition ${
                    active
                      ? "border-emerald-300/50 bg-gradient-to-br from-emerald-500/35 via-green-500/25 to-lime-400/20 text-white shadow-lg shadow-emerald-500/25"
                      : "border-transparent text-white/70 hover:border-white/10 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon size={24} strokeWidth={2.1} />

                  {active && (
                    <motion.span
                      layoutId="aurora-active-dot"
                      className="absolute -bottom-1 h-1.5 w-1.5 rounded-full bg-lime-300 shadow-[0_0_12px_rgba(124,252,0,0.95)]"
                    />
                  )}

                  {link.href === "/notifications" && unreadCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full border border-white/30 bg-rose-500 px-1 text-[10px] font-black text-white shadow-lg shadow-rose-500/40"
                    >
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </motion.span>
                  )}

                  <span className="pointer-events-none absolute -top-10 scale-90 rounded-lg border border-white/10 bg-slate-950/95 px-2 py-1 text-xs font-semibold text-white opacity-0 shadow-xl transition group-hover:scale-100 group-hover:opacity-100">
                    {link.label}
                  </span>
                </Link>
              </motion.div>
            );
          })}

          <div className="mx-1 h-9 w-px bg-white/15" />

          <motion.button
            type="button"
            onClick={handleLogout}
            onMouseEnter={() => setHoveredDockIndex(links.length)}
            onMouseLeave={() => setHoveredDockIndex(null)}
            animate={{
              y:
                hoveredDockIndex === links.length
                  ? -11
                  : hoveredDockIndex === links.length - 1
                    ? -5
                    : hoveredDockIndex === links.length - 2
                      ? -2
                      : 0,
              scale:
                hoveredDockIndex === links.length
                  ? 1.24
                  : hoveredDockIndex === links.length - 1
                    ? 1.1
                    : hoveredDockIndex === links.length - 2
                      ? 1.035
                      : 1,
            }}
            whileTap={{ scale: 0.93 }}
            transition={{ type: "spring", stiffness: 430, damping: 25 }}
            aria-label="Deconectare"
            title="Deconectare"
            className="group relative flex h-14 w-14 items-center justify-center rounded-2xl border border-transparent text-rose-300 transition hover:border-rose-300/20 hover:bg-rose-500/15 hover:text-rose-200"
          >
            <LogOut size={24} strokeWidth={2.1} />
            <span className="pointer-events-none absolute -top-10 scale-90 rounded-lg border border-white/10 bg-slate-950/95 px-2 py-1 text-xs font-semibold text-white opacity-0 shadow-xl transition group-hover:scale-100 group-hover:opacity-100">
              Deconectare
            </span>
          </motion.button>
        </motion.nav>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-slate-950/90 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-2xl md:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-1">
          {links.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-label={link.label}
                className={`relative flex h-11 min-w-10 flex-1 items-center justify-center rounded-xl transition ${
                  active
                    ? "bg-gradient-to-br from-emerald-500/40 to-lime-400/25 text-white"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={20} strokeWidth={2.1} />

                {link.href === "/notifications" && unreadCount > 0 && (
                  <span className="absolute right-0 top-0 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={handleLogout}
            aria-label="Deconectare"
            className="flex h-11 min-w-10 flex-1 items-center justify-center rounded-xl text-rose-300 transition hover:bg-rose-500/15"
          >
            <LogOut size={20} strokeWidth={2.1} />
          </button>
        </div>
      </nav>

      <div className="h-20 md:h-24" aria-hidden="true" />
    </>
  );
}