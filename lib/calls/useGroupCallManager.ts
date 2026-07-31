"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  GROUP_CALL_MAX_PARTICIPANTS,
  type CreateGroupCallInput,
  type GroupCallIdentity,
  type GroupCallKind,
  type GroupCallParticipant,
  type GroupCallSession,
  type GroupCallStatus,
  type GroupParticipantStatus,
  type JoinGroupCallInput,
} from "./groupCallTypes";
import { getPresentParticipants } from "./groupCallUtils";

type GroupCallRow = {
  id: string;
  conversation_id: number;
  kind: GroupCallKind;
  status: "active" | "ended";
  created_at: string;
  ended_at: string | null;
};

type GroupCallParticipantRow = {
  call_id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  status: GroupParticipantStatus;
  joined_at: string;
  left_at: string | null;
  is_muted: boolean;
  is_camera_off: boolean;
};

function toSession(
  call: GroupCallRow,
  participantRows: GroupCallParticipantRow[],
): GroupCallSession {
  const participants: GroupCallParticipant[] = participantRows.map((row) => ({
    userId: row.user_id,
    name: row.display_name,
    avatarUrl: row.avatar_url,
    status: row.status,
    joinedAt: row.joined_at,
    leftAt: row.left_at,
    isMuted: row.is_muted,
    isCameraOff: row.is_camera_off,
  }));

  return {
    id: call.id,
    conversationId: Number(call.conversation_id),
    kind: call.kind,
    status: call.status,
    createdAt: call.created_at,
    endedAt: call.ended_at,
    participants,
  };
}

function friendlyDatabaseError(message: string): string {
  if (message.includes("GROUP_CALL_FULL")) {
    return `Apelul a atins limita de ${GROUP_CALL_MAX_PARTICIPANTS} participanți.`;
  }
  if (message.includes("GROUP_CALL_ENDED")) {
    return "Această conferință s-a încheiat.";
  }
  if (message.includes("NOT_AUTHENTICATED")) {
    return "Trebuie să fii autentificat pentru a participa la conferință.";
  }
  if (message.includes("GROUP_CALL_NOT_FOUND")) {
    return "Conferința nu mai este disponibilă.";
  }
  return message || "Operația pentru conferință nu a putut fi finalizată.";
}

export function useGroupCallManager(currentUserId: string) {
  const [status, setStatus] = useState<GroupCallStatus>("idle");
  const [session, setSession] = useState<GroupCallSession | null>(null);
  const [error, setError] = useState("");

  const channelRef = useRef<RealtimeChannel | null>(null);
  const conferenceIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const participants = useMemo(
    () => (session ? getPresentParticipants(session) : []),
    [session],
  );

  const currentParticipant = useMemo(
    () =>
      session?.participants.find(
        (participant) => participant.userId === currentUserId,
      ) ?? null,
    [currentUserId, session],
  );

  const removeConferenceChannel = useCallback(async () => {
    const channel = channelRef.current;
    channelRef.current = null;
    if (channel) await supabase.removeChannel(channel);
  }, []);

  const loadConference = useCallback(async (conferenceId: string) => {
    const { data: call, error: callError } = await supabase
      .from("group_calls")
      .select("id, conversation_id, kind, status, created_at, ended_at")
      .eq("id", conferenceId)
      .single<GroupCallRow>();

    if (callError) throw callError;

    const { data: participantRows, error: participantError } = await supabase
      .from("group_call_participants")
      .select(
        "call_id, user_id, display_name, avatar_url, status, joined_at, left_at, is_muted, is_camera_off",
      )
      .eq("call_id", conferenceId)
      .order("joined_at", { ascending: true })
      .returns<GroupCallParticipantRow[]>();

    if (participantError) throw participantError;

    const nextSession = toSession(call, participantRows ?? []);
    if (!mountedRef.current || conferenceIdRef.current !== conferenceId) {
      return nextSession;
    }

    setSession(nextSession);

    if (nextSession.status === "ended") {
      setStatus("ended");
      setError("Conferința s-a încheiat deoarece a rămas un singur participant.");
      await removeConferenceChannel();
    } else {
      setStatus("active");
    }

    return nextSession;
  }, [removeConferenceChannel]);

  const subscribeToConference = useCallback(async (conferenceId: string) => {
    await removeConferenceChannel();
    conferenceIdRef.current = conferenceId;

    const refresh = () => {
      void loadConference(conferenceId).catch((caught) => {
        console.error("Sincronizarea conferinței a eșuat:", caught);
      });
    };

    const channel = supabase
      .channel(`friends-group-call-${conferenceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_calls",
          filter: `id=eq.${conferenceId}`,
        },
        refresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_call_participants",
          filter: `call_id=eq.${conferenceId}`,
        },
        refresh,
      )
      .subscribe((subscriptionStatus) => {
        if (subscriptionStatus === "CHANNEL_ERROR") {
          console.error("Canalul Realtime al conferinței nu s-a conectat.");
        }
      });

    channelRef.current = channel;
  }, [loadConference, removeConferenceChannel]);

  const openConference = useCallback(async (conferenceId: string) => {
    conferenceIdRef.current = conferenceId;
    await subscribeToConference(conferenceId);
    return loadConference(conferenceId);
  }, [loadConference, subscribeToConference]);

  const reset = useCallback(() => {
    void removeConferenceChannel();
    conferenceIdRef.current = null;
    setSession(null);
    setStatus("idle");
    setError("");
  }, [removeConferenceChannel]);

  const createGroupCall = useCallback(async ({
    conversationId,
    kind,
    identity,
  }: CreateGroupCallInput) => {
    if (!currentUserId || identity.userId !== currentUserId) {
      setError("Identitatea utilizatorului nu este validă.");
      setStatus("failed");
      return null;
    }

    setError("");
    setStatus("creating");

    const { data, error: createError } = await supabase.rpc(
      "create_group_call",
      {
        p_conversation_id: conversationId,
        p_kind: kind,
        p_display_name: identity.name,
        p_avatar_url: identity.avatarUrl ?? null,
      },
    );

    if (createError || !data) {
      setStatus("failed");
      setError(friendlyDatabaseError(createError?.message ?? ""));
      return null;
    }

    try {
      const nextSession = await openConference(String(data));
      setStatus("active");
      return nextSession;
    } catch (caught) {
      setStatus("failed");
      setError(
        friendlyDatabaseError(caught instanceof Error ? caught.message : ""),
      );
      return null;
    }
  }, [currentUserId, openConference]);

  const joinGroupCall = useCallback(async ({
    conferenceId,
    identity,
  }: JoinGroupCallInput) => {
    if (!currentUserId || identity.userId !== currentUserId) {
      setError("Identitatea utilizatorului nu este validă.");
      setStatus("failed");
      return false;
    }

    setError("");
    setStatus("joining");

    const { error: joinError } = await supabase.rpc("join_group_call", {
      p_call_id: conferenceId,
      p_display_name: identity.name,
      p_avatar_url: identity.avatarUrl ?? null,
    });

    if (joinError) {
      setStatus("idle");
      setError(friendlyDatabaseError(joinError.message));
      return false;
    }

    try {
      await openConference(conferenceId);
      setStatus("active");
      return true;
    } catch (caught) {
      setStatus("failed");
      setError(
        friendlyDatabaseError(caught instanceof Error ? caught.message : ""),
      );
      return false;
    }
  }, [currentUserId, openConference]);

  const rejoinGroupCall = useCallback(async (identity: GroupCallIdentity) => {
    const conferenceId = conferenceIdRef.current ?? session?.id;
    if (!conferenceId) {
      setError("Conferința nu mai este disponibilă.");
      return false;
    }

    return joinGroupCall({ conferenceId, identity });
  }, [joinGroupCall, session?.id]);

  const updateParticipantStatus = useCallback(async (
    participantStatus: Exclude<GroupParticipantStatus, "left">,
  ) => {
    const conferenceId = conferenceIdRef.current ?? session?.id;
    if (!conferenceId || !currentUserId) return;

    const { error: updateError } = await supabase.rpc(
      "set_group_call_participant_status",
      {
        p_call_id: conferenceId,
        p_status: participantStatus,
      },
    );

    if (updateError) {
      setError(friendlyDatabaseError(updateError.message));
    }
  }, [currentUserId, session?.id]);

  const markReconnecting = useCallback(() => {
    void updateParticipantStatus("reconnecting");
  }, [updateParticipantStatus]);

  const markConnected = useCallback(() => {
    void updateParticipantStatus("connected");
    setStatus("active");
    setError("");
  }, [updateParticipantStatus]);

  const leaveGroupCall = useCallback(async () => {
    const conferenceId = conferenceIdRef.current ?? session?.id;
    if (!conferenceId || !currentUserId) {
      reset();
      return;
    }

    setStatus("ending");

    const { data: conferenceEnded, error: leaveError } = await supabase.rpc(
      "leave_group_call",
      { p_call_id: conferenceId },
    );

    if (leaveError) {
      setStatus("failed");
      setError(friendlyDatabaseError(leaveError.message));
      return;
    }

    await removeConferenceChannel();

    setSession((current) => {
      if (!current) return current;
      return {
        ...current,
        status: conferenceEnded ? "ended" : current.status,
        endedAt: conferenceEnded ? new Date().toISOString() : current.endedAt,
        participants: current.participants.map((participant) =>
          participant.userId === currentUserId
            ? {
                ...participant,
                status: "left",
                leftAt: new Date().toISOString(),
              }
            : participant,
        ),
      };
    });

    if (conferenceEnded) {
      setStatus("ended");
      setError("Conferința s-a încheiat deoarece a rămas un singur participant.");
    } else {
      // Păstrăm ID-ul în memorie pentru ca utilizatorul să poată reveni.
      setStatus("idle");
      setError("");
    }
  }, [currentUserId, removeConferenceChannel, reset, session?.id]);

  const updateMediaState = useCallback(async (values: {
    isMuted?: boolean;
    isCameraOff?: boolean;
  }) => {
    const conferenceId = conferenceIdRef.current ?? session?.id;
    if (!conferenceId || !currentUserId) return;

    const { error: mediaError } = await supabase.rpc(
      "update_group_call_media_state",
      {
        p_call_id: conferenceId,
        p_is_muted: values.isMuted ?? null,
        p_is_camera_off: values.isCameraOff ?? null,
      },
    );

    if (mediaError) setError(friendlyDatabaseError(mediaError.message));
  }, [currentUserId, session?.id]);

  const toggleMute = useCallback(() => {
    if (!currentParticipant) return;
    void updateMediaState({ isMuted: !currentParticipant.isMuted });
  }, [currentParticipant, updateMediaState]);

  const toggleCamera = useCallback(() => {
    if (!currentParticipant) return;
    void updateMediaState({ isCameraOff: !currentParticipant.isCameraOff });
  }, [currentParticipant, updateMediaState]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      void removeConferenceChannel();
    };
  }, [removeConferenceChannel]);

  return {
    open: status !== "idle" && status !== "ended",
    status,
    session,
    conferenceId: session?.id ?? conferenceIdRef.current,
    participants,
    participantCount: participants.length,
    maxParticipants: GROUP_CALL_MAX_PARTICIPANTS,
    currentParticipant,
    isMuted: currentParticipant?.isMuted ?? false,
    isCameraOff: currentParticipant?.isCameraOff ?? false,
    error,
    createGroupCall,
    joinGroupCall,
    rejoinGroupCall,
    loadConference: openConference,
    markReconnecting,
    markConnected,
    leaveGroupCall,
    toggleMute,
    toggleCamera,
    reset,
  };
}
