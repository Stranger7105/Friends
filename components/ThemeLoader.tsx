"use client";

import { useEffect } from "react";

export const FRIENDS_THEMES = [
  "aurora",
  "ocean",
  "purple",
  "sunset",
  "space",
  "frozen",
  "cherry-blossom",
] as const;

export type FriendsTheme = (typeof FRIENDS_THEMES)[number];

const STORAGE_KEY = "friends-theme";
const THEME_EVENT = "friends-theme-change";

function isFriendsTheme(value: string | null): value is FriendsTheme {
  return !!value && FRIENDS_THEMES.includes(value as FriendsTheme);
}

export function getFriendsTheme(): FriendsTheme {
  if (typeof window === "undefined") return "aurora";

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isFriendsTheme(stored) ? stored : "aurora";
}

export function applyFriendsTheme(theme: FriendsTheme) {
  if (typeof document === "undefined") return;

  document.documentElement.dataset.friendsTheme = theme;

  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, theme);
    window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }));
  }
}

export default function ThemeLoader() {
  useEffect(() => {
    const applyStoredTheme = () => {
      document.documentElement.dataset.friendsTheme = getFriendsTheme();
    };

    applyStoredTheme();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) applyStoredTheme();
    };

    const handleThemeEvent = (event: Event) => {
      const theme = (event as CustomEvent<string>).detail;
      if (isFriendsTheme(theme)) {
        document.documentElement.dataset.friendsTheme = theme;
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(THEME_EVENT, handleThemeEvent);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(THEME_EVENT, handleThemeEvent);
    };
  }, []);

  return null;
}
