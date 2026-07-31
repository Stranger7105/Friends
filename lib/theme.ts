export type FriendsTheme =
  | "aurora"
  | "ocean"
  | "purple"
  | "sunset"
  | "space";

export const DEFAULT_FRIENDS_THEME: FriendsTheme = "aurora";

export const FRIENDS_THEME_STORAGE_KEY = "friends-theme";

export const FRIENDS_THEMES: FriendsTheme[] = [
  "aurora",
  "ocean",
  "purple",
  "sunset",
  "space",
];

export function isFriendsTheme(value: unknown): value is FriendsTheme {
  return (
    typeof value === "string" &&
    FRIENDS_THEMES.includes(value as FriendsTheme)
  );
}

export function getSavedFriendsTheme(): FriendsTheme {
  if (typeof window === "undefined") {
    return DEFAULT_FRIENDS_THEME;
  }

  const savedTheme = window.localStorage.getItem(
    FRIENDS_THEME_STORAGE_KEY
  );

  return isFriendsTheme(savedTheme)
    ? savedTheme
    : DEFAULT_FRIENDS_THEME;
}

export function applyFriendsTheme(theme: FriendsTheme): void {
  if (typeof document === "undefined") return;

  document.documentElement.dataset.friendsTheme = theme;
}

export function saveFriendsTheme(theme: FriendsTheme): void {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(FRIENDS_THEME_STORAGE_KEY, theme);
  applyFriendsTheme(theme);
}

export function restoreDefaultFriendsTheme(): void {
  saveFriendsTheme(DEFAULT_FRIENDS_THEME);
}