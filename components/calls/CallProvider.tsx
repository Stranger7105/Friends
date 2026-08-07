"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  createCallSession,
  getActiveCallForUser,
  getCallPeerProfile,
  updateCallStatus,
} from "./callService";
import PersistentCallOverlay from "./PersistentCallOverlay";
import type {
  ActiveCall,
  CallKind,
  CallSessionRow,
  StartCallTarget,
} from "./types";

export type CallContextValue = {
  currentUserId: string;
  activeCall: ActiveCall | null;
  busy: boolean;
  error: string;
  startCall: (
    target: StartCallTarget,
    kind?: CallKind
  ) => Promise<boolean>;
  acceptCall: () => Promise<boolean>;
  rejectCall: () => Promise<boolean>;
  cancelCall: () => Promise<boolean>;
  endCall: () => Promise<boolean>;
  clearCallError: () => void;
};

export const CallContext = createContext<CallContextValue | null>(null);

type CallProviderProps = {
  children: ReactNode;
};

function isFinished(status: CallSessionRow["status"]): boolean {
  return (
    status === "rejected" ||
    status === "cancelled" ||
    status === "ended"
  );
}

export default function CallProvider({
  children,
}: CallProviderProps) {
  const [currentUserId, setCurrentUserId] = useState("");
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const channelsRef = useRef<RealtimeChannel[]>([]);
  const peerCacheRef = useRef(
    new Map<string, { fullName: string; avatarUrl?: string }>()
  );
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFinishTimer = useCallback(() => {
    if (finishTimerRef.current) {
      clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
  }, []);

  const resolvePeer = useCallback(async (peerId: string) => {
    const cached = peerCacheRef.current.get(peerId);
    if (cached) return cached;

    const profile = await getCallPeerProfile(peerId);
    peerCacheRef.current.set(peerId, profile);
    return profile;
  }, []);

  const hydrateCall = useCallback(
    async (
      row: CallSessionRow,
      userId: string,
      localPeer?: { fullName: string; avatarUrl?: string }
    ): Promise<ActiveCall> => {
      const outgoing = row.caller_id === userId;
      const peerId = outgoing ? row.callee_id : row.caller_id;
      const peer = localPeer ?? (await resolvePeer(peerId));

      return {
        id: row.id,
        conversationId: String(row.conversation_id),
        callerId: row.caller_id,
        calleeId: row.callee_id,
        kind: row.kind,
        status: row.status,
        direction: outgoing ? "outgoing" : "incoming",
        peerId,
        peerName: peer.fullName,
        peerAvatarUrl: peer.avatarUrl,
        createdAt: row.created_at,
        acceptedAt: row.accepted_at ?? undefined,
        endedAt: row.ended_at ?? undefined,
      };
    },
    [resolvePeer]
  );

  const applyRemoteRow = useCallback(
    async (row: CallSessionRow, userId: string) => {
      if (
        row.caller_id !== userId &&
        row.callee_id !== userId
      ) {
        return;
      }

      clearFinishTimer();

      try {
        const hydrated = await hydrateCall(row, userId);
        setActiveCall(hydrated);
        setError("");

        if (isFinished(row.status)) {
          finishTimerRef.current = setTimeout(() => {
            setActiveCall((current) =>
              current?.id === row.id ? null : current
            );
          }, 1600);
        }
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Apelul nu a putut fi sincronizat."
        );
      }
    },
    [clearFinishTimer, hydrateCall]
  );

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getUser().then(async ({ data, error: authError }) => {
      if (!mounted) return;

      if (authError || !data.user) {
        setCurrentUserId("");
        return;
      }

      const userId = data.user.id;
      setCurrentUserId(userId);

      try {
        const existing = await getActiveCallForUser(userId);
        if (existing && mounted) {
          await applyRemoteRow(existing, userId);
        }
      } catch (reason) {
        if (mounted) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Apelurile nu au putut fi inițializate."
          );
        }
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setCurrentUserId(session?.user.id ?? "");
        if (!session?.user) {
          setActiveCall(null);
        }
      }
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [applyRemoteRow]);

  useEffect(() => {
    for (const channel of channelsRef.current) {
      void supabase.removeChannel(channel);
    }
    channelsRef.current = [];

    if (!currentUserId) return;

    const handlePayload = (payload: { new: unknown }) => {
      const row = payload.new as CallSessionRow;
      if (row?.id) {
        void applyRemoteRow(row, currentUserId);
      }
    };

    const incomingChannel = supabase
      .channel(`friends-calls-incoming-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "call_sessions",
          filter: `callee_id=eq.${currentUserId}`,
        },
        handlePayload
      )
      .subscribe();

    const outgoingChannel = supabase
      .channel(`friends-calls-outgoing-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "call_sessions",
          filter: `caller_id=eq.${currentUserId}`,
        },
        handlePayload
      )
      .subscribe();

    channelsRef.current = [incomingChannel, outgoingChannel];

    return () => {
      for (const channel of channelsRef.current) {
        void supabase.removeChannel(channel);
      }
      channelsRef.current = [];
    };
  }, [applyRemoteRow, currentUserId]);

  useEffect(() => {
    return () => {
      clearFinishTimer();
    };
  }, [clearFinishTimer]);

  const startCall = useCallback(
    async (
      target: StartCallTarget,
      kind: CallKind = "audio"
    ): Promise<boolean> => {
      if (!currentUserId || busy) return false;

      if (activeCall && !isFinished(activeCall.status)) {
        setError("Ai deja un apel activ.");
        return false;
      }

      setBusy(true);
      setError("");

      try {
        peerCacheRef.current.set(target.userId, {
          fullName: target.fullName,
          avatarUrl: target.avatarUrl,
        });

        const row = await createCallSession(
          target.conversationId,
          currentUserId,
          target.userId,
          kind
        );

        const hydrated = await hydrateCall(
          row,
          currentUserId,
          {
            fullName: target.fullName,
            avatarUrl: target.avatarUrl,
          }
        );
        setActiveCall(hydrated);
        return true;
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Apelul nu a putut fi pornit."
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    [activeCall, busy, currentUserId, hydrateCall]
  );

  const performStatusUpdate = useCallback(
    async (status: CallSessionRow["status"]): Promise<boolean> => {
      if (!activeCall || busy) return false;

      setBusy(true);
      setError("");

      try {
        const row = await updateCallStatus(activeCall.id, status);
        await applyRemoteRow(row, currentUserId);
        return true;
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Apelul nu a putut fi actualizat."
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    [activeCall, applyRemoteRow, busy, currentUserId]
  );

  const value = useMemo<CallContextValue>(
    () => ({
      currentUserId,
      activeCall,
      busy,
      error,
      startCall,
      acceptCall: () => performStatusUpdate("accepted"),
      rejectCall: () => performStatusUpdate("rejected"),
      cancelCall: () => performStatusUpdate("cancelled"),
      endCall: () => performStatusUpdate("ended"),
      clearCallError: () => setError(""),
    }),
    [
      activeCall,
      busy,
      currentUserId,
      error,
      performStatusUpdate,
      startCall,
    ]
  );

  return (
    <CallContext.Provider value={value}>
      {children}
      <PersistentCallOverlay />
    </CallContext.Provider>
  );
}
