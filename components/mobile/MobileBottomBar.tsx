"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  MapPinned,
  MessageCircle,
  Plus,
  User,
} from "lucide-react";

const sideLinks = [
  {
    href: "/feed",
    label: "Acasă",
    icon: Home,
  },
  {
    href: "/map",
    label: "Hartă",
    icon: MapPinned,
  },
  {
    href: "/messages",
    label: "Mesaje",
    icon: MessageCircle,
  },
  {
    href: "/profile",
    label: "Profil",
    icon: User,
  },
];

export default function MobileBottomBar() {
  const pathname = usePathname();
  const router = useRouter();

  function isActive(href: string) {
    return (
      pathname === href ||
      (href !== "/feed" && pathname.startsWith(`${href}/`))
    );
  }

  function openComposer() {
    if (pathname !== "/feed") {
      router.push("/feed?compose=1");
      return;
    }

    window.dispatchEvent(new CustomEvent("friends-mobile-compose"));
  }

  return (
    <nav className="friends-app-bottom-bar" aria-label="Navigare mobilă">
      {sideLinks.slice(0, 2).map((link) => {
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

      <button
        type="button"
        className="friends-app-create-button"
        onClick={openComposer}
        aria-label="Creează o postare"
        title="Publică"
      >
        <Plus size={27} strokeWidth={2.5} />
        <span>Publică</span>
      </button>

      {sideLinks.slice(2).map((link) => {
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
