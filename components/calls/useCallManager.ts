"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type {
  CallKind,
  CallProfile,
  CallSignal,
  CallStatus,
} from "./types";

type Options = {
  conversationId: number;
  currentUserId: string;
  otherUser: CallProfile | null;
};

export function useCallManager({
  conversationId,
  currentUserId,
  otherUser,
}: Options) {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [kind, setKind] = useState<CallKind>("audio");
  const [profile, setProfile] = useState<CallProfile | null>(null);
  const [isIncoming, setIsIncoming] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);

  const callIdRef = useRef<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const durationTimerRef = useRef<number | null>(null);

  const stopLocalMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
  }, []);

  const resetCall = useCallback(() => {
    stopLocalMedia();
    if (durationTimerRef.current) window.clearInterval(durationTimerRef.current);
    durationTimerRef.current = null;
    callIdRef.current = null;
    setDurationSeconds(0);
    setIsMuted(false);
    setIsCameraOff(false);
    setIsIncoming(false);
    setStatus("idle");
    setProfile(null);
  }, [stopLocalMedia]);

  const sendSignal = useCallback(async (signal: CallSignal) => {
    if (!channelRef.current) return;

    await channelRef.current.send({
      type: "broadcast",
      event: "call-signal",
      payload: signal,
    });
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`friends-calls-${currentUserId}`, {
        config: { broadcast: { self: false } },
      })
      .on("broadcast", { event: "call-signal" }, ({ payload }) => {
        const signal = payload as CallSignal;
        if (!signal) return;

        if (signal.type === "call-invite") {
          if (signal.calleeId !== currentUserId || status !== "idle") return;

          callIdRef.current = signal.callId;
          setKind(signal.kind);
          setProfile({
            id: signal.callerId,
            name: signal.callerName,
            avatarUrl: signal.callerAvatarUrl,
          });
          setIsIncoming(true);
          setStatus("ringing");
          return;
        }

        if (signal.callId !== callIdRef.current) return;

        if (signal.type === "call-accept") {
          setStatus("connecting");
          window.setTimeout(() => {
            setStatus("active");
            setDurationSeconds(0);
          }, 350);
        }

        if (
          signal.type === "call-reject" ||
          signal.type === "call-cancel" ||
          signal.type === "call-end"
        ) {
          setStatus(signal.type === "call-reject" ? "rejected" : "ended");
          window.setTimeout(resetCall, 900);
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [currentUserId, resetCall, status]);

  useEffect(() => {
    if (status !== "active") return;

    durationTimerRef.current = window.setInterval(() => {
      setDurationSeconds((value) => value + 1);
    }, 1000);

    return () => {
      if (durationTimerRef.current) window.clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    };
  }, [status]);

  async function requestLocalMedia(callKind: CallKind) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video:
        callKind === "video"
          ? {
              width: { ideal: 1280, max: 1280 },
              height: { ideal: 720, max: 720 },
              frameRate: { ideal: 24, max: 30 },
              facingMode: "user",
            }
          : false,
    });

    localStreamRef.current = stream;
    return stream;
  }

  async function startCall(callKind: CallKind) {
    if (!otherUser || !currentUserId || status !== "idle") return;

    try {
      await requestLocalMedia(callKind);

      const callId = crypto.randomUUID();
      callIdRef.current = callId;
      setKind(callKind);
      setProfile(otherUser);
      setIsIncoming(false);
      setStatus("calling");

      await supabase.from("calls").insert({
        id: callId,
        conversation_id: conversationId,
        caller_id: currentUserId,
        callee_id: otherUser.id,
        kind: callKind,
        status: "ringing",
      });

      await sendSignal({
        type: "call-invite",
        callId,
        conversationId,
        callerId: currentUserId,
        calleeId: otherUser.id,
        kind: callKind,
        callerName: "Prieten",
        callerAvatarUrl: null,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error(error);
      stopLocalMedia();
      setStatus("failed");
      window.setTimeout(resetCall, 1200);
    }
  }

  async function acceptCall() {
    if (!callIdRef.current || !profile) return;

    try {
      await requestLocalMedia(kind);
      setStatus("connecting");

      await supabase
        .from("calls")
        .update({ status: "active", answered_at: new Date().toISOString() })
        .eq("id", callIdRef.current);

      await sendSignal({
        type: "call-accept",
        callId: callIdRef.current,
        senderId: currentUserId,
        createdAt: new Date().toISOString(),
      });

      setStatus("active");
    } catch (error) {
      console.error(error);
      setStatus("failed");
      window.setTimeout(resetCall, 1200);
    }
  }

  async function rejectCall() {
    if (!callIdRef.current) return;

    await supabase
      .from("calls")
      .update({ status: "rejected", ended_at: new Date().toISOString() })
      .eq("id", callIdRef.current);

    await sendSignal({
      type: "call-reject",
      callId: callIdRef.current,
      senderId: currentUserId,
      createdAt: new Date().toISOString(),
    });

    resetCall();
  }

  async function endCall() {
    if (!callIdRef.current) {
      resetCall();
      return;
    }

    const signalType = status === "calling" ? "call-cancel" : "call-end";

    await supabase
      .from("calls")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", callIdRef.current);

    await sendSignal({
      type: signalType,
      callId: callIdRef.current,
      senderId: currentUserId,
      createdAt: new Date().toISOString(),
    });

    resetCall();
  }

  function toggleMute() {
    const audioTracks = localStreamRef.current?.getAudioTracks() ?? [];
    const nextMuted = !isMuted;
    audioTracks.forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
  }

  function toggleCamera() {
    const videoTracks = localStreamRef.current?.getVideoTracks() ?? [];
    const nextOff = !isCameraOff;
    videoTracks.forEach((track) => {
      track.enabled = !nextOff;
    });
    setIsCameraOff(nextOff);
  }

  return {
    open: status !== "idle",
    status,
    kind,
    profile,
    isIncoming,
    isMuted,
    isCameraOff,
    durationSeconds,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
  };
}
