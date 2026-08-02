"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Clapperboard,
  Home,
  MessageCircle,
  User,
  Users,
} from "lucide-react";

const mobileLinks = [
  {
    href: "/feed",
    label: "Acasă",
    icon: Home,
  },
  {
    href: "/reels",
    label: "Reels",
    icon: Clapperboard,
  },
  {
    href: "/messages",
    label: "Mesaje",
    icon: MessageCircle,
  },
  {
    href: "/friends",
    label: "Prieteni",
    icon: Users,
  },
  {
    href: "/profile",
    label: "Profil",
    icon: User,
  },
];

export default function MobileBottomBar() {
  const pathname = usePathname();

  function isActive(href: string) {
    return (
      pathname === href ||
      (href !== "/feed" && pathname.startsWith(`${href}/`))
    );
  }

  return (
    <nav
      className="friends-app-bottom-bar"
      aria-label="Navigare mobilă"
    >
      {mobileLinks.map((link) => {
        const Icon = link.icon;
        const active = isActive(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`friends-app-bottom-link ${
              active ? "is-active" : ""
            }`}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={22} strokeWidth={active ? 2.5 : 2} />
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}