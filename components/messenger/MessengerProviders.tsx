"use client";

import type { ReactNode } from "react";
import { MessengerProvider } from "@/contexts/MessengerContext";
import { PresenceProvider } from "@/contexts/PresenceContext";
import { CallProvider } from "@/contexts/CallContext";

export default function MessengerProviders({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <MessengerProvider>
      <PresenceProvider>
        <CallProvider>{children}</CallProvider>
      </PresenceProvider>
    </MessengerProvider>
  );
}
