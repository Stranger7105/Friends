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
export type FriendsThemeMode = "dark" | "light";

const STORAGE_KEY = "friends-theme";
const THEME_EVENT = "friends-theme-change";

const LIGHT_THEMES = new Set<FriendsTheme>([
  "frozen",
  "cherry-blossom",
]);

function isFriendsTheme(value: string | null): value is FriendsTheme {
  return !!value && FRIENDS_THEMES.includes(value as FriendsTheme);
}

function getThemeMode(theme: FriendsTheme): FriendsThemeMode {
  return LIGHT_THEMES.has(theme) ? "light" : "dark";
}

function setThemeAttributes(theme: FriendsTheme) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const mode = getThemeMode(theme);

  root.dataset.friendsTheme = theme;
  root.dataset.themeMode = mode;
  root.style.colorScheme = mode;
}

export function getFriendsTheme(): FriendsTheme {
  if (typeof window === "undefined") return "aurora";

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isFriendsTheme(stored) ? stored : "aurora";
}

export function applyFriendsTheme(theme: FriendsTheme) {
  setThemeAttributes(theme);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, theme);
    window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }));
  }
}

export default function ThemeLoader() {
  useEffect(() => {
    const applyStoredTheme = () => {
      setThemeAttributes(getFriendsTheme());
    };

    applyStoredTheme();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) applyStoredTheme();
    };

    const handleThemeEvent = (event: Event) => {
      const theme = (event as CustomEvent<string>).detail;

      if (isFriendsTheme(theme)) {
        setThemeAttributes(theme);
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
