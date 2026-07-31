"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { MessengerCall } from "@/types/messenger";

type CallContextValue = {
  activeCall: MessengerCall | null;
  setActiveCall: (call: MessengerCall | null) => void;
  endCallLocally: () => void;
};

const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({ children }: { children: ReactNode }) {
  const [activeCall, setActiveCall] = useState<MessengerCall | null>(null);

  const endCallLocally = useCallback(() => {
    setActiveCall((current) =>
      current
        ? {
            ...current,
            status: "ended",
            endedAt: new Date().toISOString(),
          }
        : null
    );
  }, []);

  const value = useMemo(
    () => ({ activeCall, setActiveCall, endCallLocally }),
    [activeCall, endCallLocally]
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCallContext() {
  const context = useContext(CallContext);

  if (!context) {
    throw new Error(
      "useCallContext trebuie folosit în interiorul CallProvider."
    );
  }

  return context;
}
