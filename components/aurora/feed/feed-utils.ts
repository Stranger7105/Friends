import type { Profile } from "./feed-types";

export function getDisplayName(profile: Profile | null) {
  return profile?.full_name || profile?.username || "Utilizator";
}

export function getInitials(profile: Profile | null) {
  return getDisplayName(profile)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function formatRelativeDate(value: string) {
  const date = new Date(value);
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 1000)
  );

  if (seconds < 30) return "acum";
  if (seconds < 60) return `acum ${seconds} secunde`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `acum ${minutes} ${minutes === 1 ? "minut" : "minute"}`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `acum ${hours} ${hours === 1 ? "oră" : "ore"}`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `acum ${days} ${days === 1 ? "zi" : "zile"}`;
  }

  return date.toLocaleString("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
