"use client";

import { usePresenceContext } from "@/contexts/PresenceContext";

export function usePresence(userId?: string | null) {
  const { presenceByUserId, setPresence, removePresence } =
    usePresenceContext();

  return {
    presence: userId ? presenceByUserId[userId] ?? null : null,
    presenceByUserId,
    setPresence,
    removePresence,
  };
}
