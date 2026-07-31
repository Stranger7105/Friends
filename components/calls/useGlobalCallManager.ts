"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { CallContact, CallKind, CallSignal, CallStatus } from "./callTypes";

type StartCallInput = {
  contact: CallContact;
  conversationId: number;
  kind: CallKind;
};

export type ConnectionQuality = "unknown" | "excellent" | "good" | "fair" | "poor";

const RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export function useGlobalCallManager(currentUserId: string) {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [kind, setKind] = useState<CallKind>("audio");
  const [contact, setContact] = useState<CallContact | null>(null);
  const [isIncoming, setIsIncoming] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [error, setError] = useState("");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>("unknown");

  const channelRef = useRef<RealtimeChannel | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callIdRef = useRef("");
  const remoteUserIdRef = useRef("");
  const conversationIdRef = useRef<number | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const queuedIceRef = useRef<RTCIceCandidateInit[]>([]);
  const durationTimerRef = useRef<number | null>(null);
  const qualityTimerRef = useRef<number | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const statusRef = useRef<CallStatus>("idle");
  const channelReadyRef = useRef(false);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const safeUpdateCall = useCallback(async (values: Record<string, unknown>) => {
    if (!callIdRef.current) return;
    const { error: updateError } = await supabase
      .from("calls")
      .update(values)
      .eq("id", callIdRef.current);
    if (updateError) console.info("Istoricul apelului nu s-a actualizat:", updateError.message);
  }, []);

  const waitForChannel = useCallback(async () => {
    const startedAt = Date.now();

    while (!channelReadyRef.current) {
      if (Date.now() - startedAt > 5000) {
        throw new Error("Conexiunea pentru apeluri nu este încă pregătită.");
      }
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }

    const channel = channelRef.current;
    if (!channel) throw new Error("Canalul de apel nu este pregătit.");
    return channel;
  }, []);

  const sendSignal = useCallback(async (signal: CallSignal) => {
    const channel = await waitForChannel();
    const result = await channel.send({
      type: "broadcast",
      event: "call-signal",
      payload: signal,
    });

    if (result !== "ok") {
      throw new Error("Semnalul apelului nu a putut fi trimis.");
    }
  }, [waitForChannel]);

  const stopTracks = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
  }, []);

  const closePeer = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.onicecandidate = null;
      peerRef.current.ontrack = null;
      peerRef.current.onconnectionstatechange = null;
      peerRef.current.close();
      peerRef.current = null;
    }
  }, []);

  const resetCall = useCallback(() => {
    if (durationTimerRef.current) window.clearInterval(durationTimerRef.current);
    durationTimerRef.current = null;
    if (qualityTimerRef.current) window.clearInterval(qualityTimerRef.current);
    qualityTimerRef.current = null;
    if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = null;
    setConnectionQuality("unknown");
    closePeer();
    stopTracks();
    callIdRef.current = "";
    remoteUserIdRef.current = "";
    conversationIdRef.current = null;
    pendingOfferRef.current = null;
    queuedIceRef.current = [];
    statusRef.current = "idle";
    setStatus("idle");
    setContact(null);
    setIsIncoming(false);
    setIsMuted(false);
    setIsCameraOff(false);
    setDurationSeconds(0);
  }, [closePeer, stopTracks]);

  const mediaErrorMessage = useCallback((caught: unknown, device: "audio" | "video" | "both") => {
    if (!(caught instanceof DOMException)) {
      return caught instanceof Error ? caught.message : "Dispozitivele audio/video nu au putut fi pornite.";
    }

    if (caught.name === "NotAllowedError" || caught.name === "SecurityError") {
      if (!window.isSecureContext) {
        return "Apelurile funcționează doar prin HTTPS sau pe localhost.";
      }
      return device === "audio"
        ? "Accesul la microfon a fost refuzat. Permite microfonul din setările browserului."
        : device === "video"
          ? "Accesul la cameră a fost refuzat. Permite camera din setările browserului."
          : "Accesul la microfon și/sau cameră a fost refuzat.";
    }

    if (caught.name === "NotFoundError" || caught.name === "DevicesNotFoundError") {
      return device === "audio"
        ? "Nu a fost găsit niciun microfon."
        : device === "video"
          ? "Nu a fost găsită nicio cameră."
          : "Nu a fost găsit niciun microfon sau nicio cameră.";
    }

    if (caught.name === "NotReadableError" || caught.name === "TrackStartError") {
      return device === "audio"
        ? "Microfonul este folosit de altă aplicație sau nu poate fi pornit."
        : device === "video"
          ? "Camera este folosită de altă aplicație sau nu poate fi pornită."
          : "Camera sau microfonul este folosit de altă aplicație.";
    }

    if (caught.name === "OverconstrainedError") {
      return "Dispozitivul nu acceptă setările media solicitate.";
    }

    if (caught.name === "AbortError") {
      return "Pornirea camerei sau a microfonului a fost întreruptă.";
    }

    return caught.message || "Dispozitivele audio/video nu au putut fi pornite.";
  }, []);

  const getMedia = useCallback(async (callKind: CallKind) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Browserul nu permite accesul la microfon sau cameră.");
    }

    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: callKind === "video"
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 24, max: 30 },
              facingMode: "user",
            }
          : false,
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (mediaError) {
      if (callKind !== "video") {
        throw new Error(mediaErrorMessage(mediaError, "audio"));
      }

      try {
        const audioOnlyStream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
          video: false,
        });

        localStreamRef.current = audioOnlyStream;
        setLocalStream(audioOnlyStream);
        setIsCameraOff(true);
        setError(`${mediaErrorMessage(mediaError, "video")} Apelul continuă doar cu audio.`);
        return audioOnlyStream;
      } catch (audioError) {
        throw new Error(mediaErrorMessage(audioError, "audio"));
      }
    }
  }, [mediaErrorMessage]);

  const optimizeAudioSender = useCallback(async (sender: RTCRtpSender) => {
    const prepareParameters = () => {
      const parameters = sender.getParameters();
      parameters.encodings = parameters.encodings?.length
        ? parameters.encodings
        : [{}];

      // Calitate bună pentru voce, cu un consum redus și previzibil de bandă.
      parameters.encodings[0].maxBitrate = 64000;
      return parameters;
    };

    try {
      const parameters = prepareParameters();

      // Browserele compatibile vor acorda prioritate transmisiei audio.
      const audioEncoding = parameters.encodings[0] as RTCRtpEncodingParameters & {
        priority?: "very-low" | "low" | "medium" | "high";
        networkPriority?: "very-low" | "low" | "medium" | "high";
      };
      audioEncoding.priority = "high";
      audioEncoding.networkPriority = "high";

      await sender.setParameters(parameters);
    } catch (priorityError) {
      try {
        // Compatibilitate: păstrăm optimizarea de bitrate chiar dacă prioritatea
        // de rețea nu este acceptată de browser.
        await sender.setParameters(prepareParameters());
      } catch (senderError) {
        // Optimizarea este opțională; apelul continuă normal.
        console.info("Optimizarea audio nu a putut fi aplicată:", senderError, priorityError);
      }
    }
  }, []);

  const addLocalTracks = useCallback((peer: RTCPeerConnection, stream: MediaStream) => {
    stream.getTracks().forEach((track) => {
      const sender = peer.addTrack(track, stream);
      if (track.kind === "audio") void optimizeAudioSender(sender);
    });
  }, [optimizeAudioSender]);

  const createPeer = useCallback((remoteUserId: string) => {
    closePeer();
    const peer = new RTCPeerConnection(RTC_CONFIGURATION);
    const incomingStream = new MediaStream();
    setRemoteStream(incomingStream);

    peer.ontrack = (event) => {
      for (const track of event.streams[0]?.getTracks() ?? [event.track]) {
        if (!incomingStream.getTracks().some((item) => item.id === track.id)) incomingStream.addTrack(track);
      }
      setRemoteStream(new MediaStream(incomingStream.getTracks()));
    };

    peer.onicecandidate = (event) => {
      if (!event.candidate || !callIdRef.current || !currentUserId) return;
      void sendSignal({
        type: "call-ice",
        callId: callIdRef.current,
        senderId: currentUserId,
        recipientId: remoteUserId,
        candidate: event.candidate.toJSON(),
        createdAt: new Date().toISOString(),
      }).catch(console.error);
    };

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "connected") {
        if (reconnectTimerRef.current) {
          window.clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }

        setError((currentError) =>
          currentError === "Se reconectează…" ? "" : currentError
        );
        statusRef.current = "active";
        setStatus("active");
        return;
      }

      if (peer.connectionState === "disconnected") {
        setError("Se reconectează…");

        if (!reconnectTimerRef.current) {
          reconnectTimerRef.current = window.setTimeout(() => {
            reconnectTimerRef.current = null;

            if (peer.connectionState === "connected" || peerRef.current !== peer) return;

            setError("Conexiunea nu a putut fi restabilită.");
            statusRef.current = "failed";
            setStatus("failed");
            window.setTimeout(resetCall, 1800);
          }, 15000);
        }
        return;
      }

      if (peer.connectionState === "failed") {
        if (reconnectTimerRef.current) {
          window.clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }

        setError("Conexiunea apelului s-a întrerupt.");
        statusRef.current = "failed";
        setStatus("failed");
        window.setTimeout(resetCall, 1800);
      }
    };

    peerRef.current = peer;
    return peer;
  }, [closePeer, currentUserId, resetCall, sendSignal]);

  const addQueuedIce = useCallback(async () => {
    const peer = peerRef.current;
    if (!peer?.remoteDescription) return;
    const queued = [...queuedIceRef.current];
    queuedIceRef.current = [];
    for (const candidate of queued) {
      try { await peer.addIceCandidate(candidate); } catch (iceError) { console.error(iceError); }
    }
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    channelReadyRef.current = false;

    const channel = supabase
      .channel("friends-global-calls", {
        config: {
          broadcast: { self: false },
        },
      })
      .on("broadcast", { event: "call-signal" }, async ({ payload }) => {
        const signal = payload as CallSignal;
        if (!signal) return;

        if (signal.type === "call-invite") {
          if (signal.calleeId !== currentUserId) return;

          if (statusRef.current !== "idle") {
            await sendSignal({
              type: "call-reject",
              callId: signal.callId,
              senderId: currentUserId,
              recipientId: signal.callerId,
              createdAt: new Date().toISOString(),
            }).catch(console.error);
            return;
          }

          callIdRef.current = signal.callId;
          remoteUserIdRef.current = signal.callerId;
          conversationIdRef.current = signal.conversationId;
          pendingOfferRef.current = signal.offer;
          statusRef.current = "ringing";

          setKind(signal.kind);
          setContact({
            id: signal.callerId,
            name: signal.callerName,
            avatarUrl: signal.callerAvatarUrl,
          });
          setIsIncoming(true);
          setStatus("ringing");
          setError("");
          return;
        }

        if (
          signal.recipientId !== currentUserId ||
          signal.callId !== callIdRef.current
        ) {
          return;
        }

        try {
          if (signal.type === "call-answer") {
            const peer = peerRef.current;
            if (!peer) return;

            await peer.setRemoteDescription(signal.answer);
            await addQueuedIce();
            statusRef.current = "connecting";
            setStatus("connecting");
            return;
          }

          if (signal.type === "call-ice") {
            const peer = peerRef.current;

            if (!peer?.remoteDescription) {
              queuedIceRef.current.push(signal.candidate);
            } else {
              await peer.addIceCandidate(signal.candidate);
            }
            return;
          }

          if (signal.type === "call-reject") {
            statusRef.current = "rejected";
            setStatus("rejected");
            setError("Apelul a fost refuzat sau persoana este ocupată.");
            window.setTimeout(resetCall, 1600);
            return;
          }

          if (signal.type === "call-cancel" || signal.type === "call-end") {
            statusRef.current = "ended";
            setStatus("ended");
            window.setTimeout(resetCall, 900);
          }
        } catch (signalError) {
          console.error("Eroare semnalizare apel:", signalError);
          statusRef.current = "failed";
          setError("Conexiunea apelului nu a putut fi negociată.");
          statusRef.current = "failed";
        setStatus("failed");
          window.setTimeout(resetCall, 1800);
        }
      })
      .subscribe((subscriptionStatus) => {
        channelReadyRef.current = subscriptionStatus === "SUBSCRIBED";

        if (subscriptionStatus === "CHANNEL_ERROR") {
          console.error("Canalul Friends Calls nu s-a putut conecta.");
        }
      });

    channelRef.current = channel;

    return () => {
      channelReadyRef.current = false;
      channelRef.current = null;
      void supabase.removeChannel(channel);
      resetCall();
    };
  }, [addQueuedIce, currentUserId, resetCall, sendSignal]);

  useEffect(() => {
    if (status !== "active") return;
    durationTimerRef.current = window.setInterval(() => setDurationSeconds((value) => value + 1), 1000);
    return () => {
      if (durationTimerRef.current) window.clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    };
  }, [status]);

  useEffect(() => {
    if (status !== "active") {
      setConnectionQuality("unknown");
      return;
    }

    const measureQuality = async () => {
      const peer = peerRef.current;
      if (!peer || peer.connectionState !== "connected") return;

      try {
        const stats = await peer.getStats();
        let packetsLost = 0;
        let packetsReceived = 0;
        let roundTripTime: number | null = null;

        stats.forEach((report) => {
          if (report.type === "inbound-rtp" && !report.isRemote) {
            packetsLost += Number(report.packetsLost ?? 0);
            packetsReceived += Number(report.packetsReceived ?? 0);
          }

          if (
            report.type === "candidate-pair" &&
            report.state === "succeeded" &&
            (report.nominated || report.selected)
          ) {
            const value = Number(report.currentRoundTripTime);
            if (Number.isFinite(value)) roundTripTime = value * 1000;
          }
        });

        const totalPackets = packetsReceived + Math.max(0, packetsLost);
        const lossPercent = totalPackets > 0 ? (Math.max(0, packetsLost) / totalPackets) * 100 : 0;
        const latency = roundTripTime ?? 0;

        if (lossPercent <= 1 && latency <= 150) {
          setConnectionQuality("excellent");
        } else if (lossPercent <= 3 && latency <= 250) {
          setConnectionQuality("good");
        } else if (lossPercent <= 7 && latency <= 400) {
          setConnectionQuality("fair");
        } else {
          setConnectionQuality("poor");
        }
      } catch (statsError) {
        console.info("Calitatea conexiunii nu a putut fi măsurată:", statsError);
        setConnectionQuality("unknown");
      }
    };

    void measureQuality();
    qualityTimerRef.current = window.setInterval(() => void measureQuality(), 3000);

    return () => {
      if (qualityTimerRef.current) window.clearInterval(qualityTimerRef.current);
      qualityTimerRef.current = null;
    };
  }, [status]);

  // Pack A.1: închide automat apelul dacă nu primește răspuns în 30 de secunde.
  // Timerul există numai cât timp starea este "calling", deci este oprit automat
  // imediat ce apelul este acceptat, refuzat, închis sau eșuează.
  useEffect(() => {
    if (status !== "calling") return;

    const unansweredTimer = window.setTimeout(() => {
      void (async () => {
        if (statusRef.current !== "calling") return;

        statusRef.current = "ended";
        setStatus("ended");
        setError("Nu s-a răspuns.");

        await safeUpdateCall({
          status: "missed",
          ended_at: new Date().toISOString(),
        });

        const callId = callIdRef.current;
        const recipientId = remoteUserIdRef.current;

        if (callId && recipientId && currentUserId) {
          await sendSignal({
            type: "call-cancel",
            callId,
            senderId: currentUserId,
            recipientId,
            createdAt: new Date().toISOString(),
          }).catch(console.error);
        }

        window.setTimeout(resetCall, 1200);
      })();
    }, 30000);

    return () => window.clearTimeout(unansweredTimer);
  }, [currentUserId, resetCall, safeUpdateCall, sendSignal, status]);

  async function startCall({ contact: nextContact, conversationId, kind: nextKind }: StartCallInput) {
    if (!currentUserId || status !== "idle") return;
    setError("");

    try {
      const stream = await getMedia(nextKind);
      const effectiveKind: CallKind =
        nextKind === "video" && stream.getVideoTracks().length === 0
          ? "audio"
          : nextKind;

      const callId = crypto.randomUUID();
      callIdRef.current = callId;
      remoteUserIdRef.current = nextContact.id;
      conversationIdRef.current = conversationId;
      setContact(nextContact);
      setKind(effectiveKind);
      setIsIncoming(false);
      statusRef.current = "calling";
      setStatus("calling");

      const peer = createPeer(nextContact.id);
      addLocalTracks(peer, stream);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      const { error: insertError } = await supabase.from("calls").insert({
        id: callId,
        conversation_id: conversationId,
        caller_id: currentUserId,
        callee_id: nextContact.id,
        kind: effectiveKind,
        status: "ringing",
      });
      if (insertError) console.info("Istoricul apelului nu s-a salvat:", insertError.message);

      await sendSignal({
        type: "call-invite",
        callId,
        conversationId,
        callerId: currentUserId,
        calleeId: nextContact.id,
        kind: effectiveKind,
        callerName: "Prieten Friends",
        callerAvatarUrl: null,
        offer,
        createdAt: new Date().toISOString(),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Apelul nu a putut fi pornit.");
      statusRef.current = "failed";
      setStatus("failed");
      window.setTimeout(resetCall, 1800);
    }
  }

  async function acceptCall() {
    if (!pendingOfferRef.current || !contact || !currentUserId) return;
    setError("");
    try {
      statusRef.current = "connecting";
      setStatus("connecting");
      const stream = await getMedia(kind);
      const peer = createPeer(contact.id);
      addLocalTracks(peer, stream);
      await peer.setRemoteDescription(pendingOfferRef.current);
      await addQueuedIce();
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await safeUpdateCall({ status: "active", answered_at: new Date().toISOString() });
      await sendSignal({
        type: "call-answer",
        callId: callIdRef.current,
        senderId: currentUserId,
        recipientId: contact.id,
        answer,
        createdAt: new Date().toISOString(),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Apelul nu a putut fi acceptat.");
      statusRef.current = "failed";
      setStatus("failed");
      window.setTimeout(resetCall, 1800);
    }
  }

  async function rejectCall() {
    if (!contact || !currentUserId || !callIdRef.current) return resetCall();
    await safeUpdateCall({ status: "rejected", ended_at: new Date().toISOString() });
    await sendSignal({
      type: "call-reject",
      callId: callIdRef.current,
      senderId: currentUserId,
      recipientId: contact.id,
      createdAt: new Date().toISOString(),
    }).catch(console.error);
    resetCall();
  }

  async function endCall() {
    if (!contact || !currentUserId || !callIdRef.current) return resetCall();
    const type = status === "calling" ? "call-cancel" : "call-end";
    await safeUpdateCall({ status: "ended", ended_at: new Date().toISOString(), duration_seconds: durationSeconds });
    await sendSignal({
      type,
      callId: callIdRef.current,
      senderId: currentUserId,
      recipientId: contact.id,
      createdAt: new Date().toISOString(),
    }).catch(console.error);
    resetCall();
  }

  function toggleMute() {
    const next = !isMuted;
    localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next; });
    setIsMuted(next);
  }

  function toggleCamera() {
    const next = !isCameraOff;
    localStreamRef.current?.getVideoTracks().forEach((track) => { track.enabled = !next; });
    setIsCameraOff(next);
  }

  return {
    open: status !== "idle",
    status,
    kind,
    contact,
    isIncoming,
    isMuted,
    isCameraOff,
    durationSeconds,
    error,
    localStream,
    remoteStream,
    connectionQuality,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
  };
}