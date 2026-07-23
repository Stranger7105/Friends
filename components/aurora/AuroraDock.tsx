// components/aurora/AuroraDock.tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Home, Users, UserCheck, UserPlus, MessageCircle, Bell, User, LogOut } from "lucide-react";

type Props = {
  pathname: string;
  unreadCount: number;
  onLogout: () => void;
};

const items = [
  { href: "/feed", icon: <Home size={22} /> },
  { href: "/people", icon: <Users size={22} /> },
  { href: "/friends", icon: <UserCheck size={22} /> },
  { href: "/requests", icon: <UserPlus size={22} /> },
  { href: "/messages", icon: <MessageCircle size={22} /> },
  { href: "/notifications", icon: <Bell size={22} /> },
  { href: "/profile", icon: <User size={22} /> },
];

export default function AuroraDock({ pathname, unreadCount, onLogout }: Props) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="glass-glow flex gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-xl shadow-2xl">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== "/feed" && pathname.startsWith(item.href + "/"));
          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileHover={{ scale: 1.25, y: -8 }}
                transition={{ type: "spring", stiffness: 350, damping: 18 }}
                className={`relative flex h-12 w-12 items-center justify-center rounded-full ${
                  active ? "bg-emerald-500 text-white" : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {item.icon}
                {item.href === "/notifications" && unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1 text-[10px] text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </motion.div>
            </Link>
          );
        })}
        <motion.button
          whileHover={{ scale: 1.25, y: -8 }}
          transition={{ type: "spring", stiffness: 350, damping: 18 }}
          onClick={onLogout}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white"
        >
          <LogOut size={22} />
        </motion.button>
      </div>
    </div>
  );
}