"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { MessengerPresence, PresenceState } from "@/types/messenger";

type PresenceContextValue = {
  presenceByUserId: Record<string, MessengerPresence>;
  setPresence: (
    userId: string,
    state: PresenceState,
    lastSeenAt?: string | null
  ) => void;
  removePresence: (userId: string) => void;
};

const PresenceContext = createContext<PresenceContextValue | null>(null);

export function PresenceProvider({ children }: { children: ReactNode }) {
  const [presenceByUserId, setPresenceByUserId] = useState<
    Record<string, MessengerPresence>
  >({});

  const setPresence = useCallback(
    (
      userId: string,
      state: PresenceState,
      lastSeenAt: string | null = null
    ) => {
      setPresenceByUserId((current) => ({
        ...current,
        [userId]: { userId, state, lastSeenAt },
      }));
    },
    []
  );

  const removePresence = useCallback((userId: string) => {
    setPresenceByUserId((current) => {
      const next = { ...current };
      delete next[userId];
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ presenceByUserId, setPresence, removePresence }),
    [presenceByUserId, setPresence, removePresence]
  );

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresenceContext() {
  const context = useContext(PresenceContext);

  if (!context) {
    throw new Error(
      "usePresenceContext trebuie folosit în interiorul PresenceProvider."
    );
  }

  return context;
}
