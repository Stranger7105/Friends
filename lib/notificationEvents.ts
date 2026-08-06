"use client";

export const FRIENDS_NOTIFICATIONS_CHANGED =
  "friends:notifications-changed";

export function notifyNotificationCountsChanged(): void {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(FRIENDS_NOTIFICATIONS_CHANGED)
  );
}
