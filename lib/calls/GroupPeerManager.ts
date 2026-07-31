"use client";

export type GroupPeerConnectionState =
  | "new"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed"
  | "closed";

export type GroupPeerSignal =
  | {
      type: "group-offer";
      callId: string;
      senderId: string;
      recipientId: string;
      description: RTCSessionDescriptionInit;
      createdAt: string;
    }
  | {
      type: "group-answer";
      callId: string;
      senderId: string;
      recipientId: string;
      description: RTCSessionDescriptionInit;
      createdAt: string;
    }
  | {
      type: "group-ice";
      callId: string;
      senderId: string;
      recipientId: string;
      candidate: RTCIceCandidateInit;
      createdAt: string;
    };

export type GroupPeerSnapshot = {
  participantId: string;
  connectionState: GroupPeerConnectionState;
  remoteStream: MediaStream | null;
};

type GroupPeerManagerOptions = {
  currentUserId: string;
  callId: string;
  localStream: MediaStream;
  sendSignal: (signal: GroupPeerSignal) => Promise<void>;
  onRemoteStream?: (participantId: string, stream: MediaStream) => void;
  onConnectionStateChange?: (
    participantId: string,
    state: GroupPeerConnectionState,
  ) => void;
  onError?: (participantId: string, error: Error) => void;
  rtcConfiguration?: RTCConfiguration;
};

type PeerEntry = {
  peer: RTCPeerConnection;
  remoteStream: MediaStream;
  queuedIce: RTCIceCandidateInit[];
  makingOffer: boolean;
  ignoreOffer: boolean;
  polite: boolean;
  closed: boolean;
};

const DEFAULT_RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

function toError(value: unknown, fallback: string) {
  return value instanceof Error ? value : new Error(fallback);
}

function normalizeConnectionState(
  peer: RTCPeerConnection,
): GroupPeerConnectionState {
  if (peer.connectionState === "connected") return "connected";
  if (peer.connectionState === "connecting") return "connecting";
  if (peer.connectionState === "disconnected") return "disconnected";
  if (peer.connectionState === "failed") return "failed";
  if (peer.connectionState === "closed") return "closed";
  return "new";
}

/**
 * Administrează conexiunile WebRTC mesh pentru un apel de grup.
 *
 * Regula de negociere:
 * utilizatorul cu ID-ul mai mare este "polite". Aceasta evită coliziunile
 * atunci când doi participanți creează simultan câte un offer.
 */
export class GroupPeerManager {
  private readonly currentUserId: string;
  private readonly callId: string;
  private readonly localStream: MediaStream;
  private readonly sendSignal: GroupPeerManagerOptions["sendSignal"];
  private readonly onRemoteStream?: GroupPeerManagerOptions["onRemoteStream"];
  private readonly onConnectionStateChange?: GroupPeerManagerOptions["onConnectionStateChange"];
  private readonly onError?: GroupPeerManagerOptions["onError"];
  private readonly rtcConfiguration: RTCConfiguration;

  private readonly peers = new Map<string, PeerEntry>();
  private destroyed = false;

  constructor(options: GroupPeerManagerOptions) {
    this.currentUserId = options.currentUserId;
    this.callId = options.callId;
    this.localStream = options.localStream;
    this.sendSignal = options.sendSignal;
    this.onRemoteStream = options.onRemoteStream;
    this.onConnectionStateChange = options.onConnectionStateChange;
    this.onError = options.onError;
    this.rtcConfiguration =
      options.rtcConfiguration ?? DEFAULT_RTC_CONFIGURATION;
  }

  hasPeer(participantId: string) {
    return this.peers.has(participantId);
  }

  getParticipantIds() {
    return [...this.peers.keys()];
  }

  getSnapshot(): GroupPeerSnapshot[] {
    return [...this.peers.entries()].map(([participantId, entry]) => ({
      participantId,
      connectionState: normalizeConnectionState(entry.peer),
      remoteStream:
        entry.remoteStream.getTracks().length > 0
          ? new MediaStream(entry.remoteStream.getTracks())
          : null,
    }));
  }

  async connectToParticipant(participantId: string) {
    this.assertUsable();

    if (!participantId || participantId === this.currentUserId) return;

    const entry = this.ensurePeer(participantId);

    if (
      entry.peer.signalingState !== "stable" ||
      entry.peer.connectionState === "connected"
    ) {
      return;
    }

    try {
      entry.makingOffer = true;
      const offer = await entry.peer.createOffer();
      await entry.peer.setLocalDescription(offer);

      if (!entry.peer.localDescription) {
        throw new Error("Oferta WebRTC nu a putut fi creată.");
      }

      await this.sendSignal({
        type: "group-offer",
        callId: this.callId,
        senderId: this.currentUserId,
        recipientId: participantId,
        description: entry.peer.localDescription.toJSON(),
        createdAt: new Date().toISOString(),
      });
    } catch (caught) {
      this.reportError(
        participantId,
        toError(caught, "Conexiunea cu participantul nu a putut fi pornită."),
      );
    } finally {
      entry.makingOffer = false;
    }
  }

  async handleSignal(signal: GroupPeerSignal) {
    this.assertUsable();

    if (
      signal.callId !== this.callId ||
      signal.recipientId !== this.currentUserId ||
      signal.senderId === this.currentUserId
    ) {
      return;
    }

    const participantId = signal.senderId;
    const entry = this.ensurePeer(participantId);

    try {
      if (signal.type === "group-ice") {
        if (!entry.peer.remoteDescription) {
          entry.queuedIce.push(signal.candidate);
          return;
        }

        await entry.peer.addIceCandidate(signal.candidate);
        return;
      }

      const offerCollision =
        signal.type === "group-offer" &&
        (entry.makingOffer || entry.peer.signalingState !== "stable");

      entry.ignoreOffer = !entry.polite && offerCollision;
      if (entry.ignoreOffer) return;

      if (offerCollision && entry.polite) {
        await entry.peer.setLocalDescription({ type: "rollback" });
      }

      await entry.peer.setRemoteDescription(signal.description);
      await this.flushQueuedIce(entry);

      if (signal.type === "group-offer") {
        const answer = await entry.peer.createAnswer();
        await entry.peer.setLocalDescription(answer);

        if (!entry.peer.localDescription) {
          throw new Error("Răspunsul WebRTC nu a putut fi creat.");
        }

        await this.sendSignal({
          type: "group-answer",
          callId: this.callId,
          senderId: this.currentUserId,
          recipientId: participantId,
          description: entry.peer.localDescription.toJSON(),
          createdAt: new Date().toISOString(),
        });
      }
    } catch (caught) {
      if (entry.ignoreOffer) return;

      this.reportError(
        participantId,
        toError(caught, "Semnalizarea conferinței a eșuat."),
      );
    }
  }

  setMicrophoneEnabled(enabled: boolean) {
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }

  setCameraEnabled(enabled: boolean) {
    this.localStream.getVideoTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }

  async replaceAudioTrack(track: MediaStreamTrack | null) {
    await this.replaceTrack("audio", track);
  }

  async replaceVideoTrack(track: MediaStreamTrack | null) {
    await this.replaceTrack("video", track);
  }

  removeParticipant(participantId: string) {
    const entry = this.peers.get(participantId);
    if (!entry) return;

    entry.closed = true;
    entry.peer.onicecandidate = null;
    entry.peer.ontrack = null;
    entry.peer.onconnectionstatechange = null;
    entry.peer.onnegotiationneeded = null;
    entry.peer.close();

    entry.remoteStream.getTracks().forEach((track) => track.stop());
    this.peers.delete(participantId);

    this.onConnectionStateChange?.(participantId, "closed");
  }

  closeAll() {
    if (this.destroyed) return;
    this.destroyed = true;

    for (const participantId of [...this.peers.keys()]) {
      this.removeParticipant(participantId);
    }

    this.peers.clear();
  }

  private ensurePeer(participantId: string) {
    const existing = this.peers.get(participantId);
    if (existing) return existing;

    const peer = new RTCPeerConnection(this.rtcConfiguration);
    const remoteStream = new MediaStream();

    const entry: PeerEntry = {
      peer,
      remoteStream,
      queuedIce: [],
      makingOffer: false,
      ignoreOffer: false,
      polite: this.currentUserId.localeCompare(participantId) > 0,
      closed: false,
    };

    this.localStream.getTracks().forEach((track) => {
      const sender = peer.addTrack(track, this.localStream);
      if (track.kind === "audio") {
        void this.optimizeAudioSender(sender);
      }
    });

    peer.ontrack = (event) => {
      const tracks =
        event.streams[0]?.getTracks() ??
        (event.track ? [event.track] : []);

      for (const track of tracks) {
        if (!remoteStream.getTracks().some((item) => item.id === track.id)) {
          remoteStream.addTrack(track);
        }
      }

      this.onRemoteStream?.(
        participantId,
        new MediaStream(remoteStream.getTracks()),
      );
    };

    peer.onicecandidate = (event) => {
      if (!event.candidate || entry.closed || this.destroyed) return;

      void this.sendSignal({
        type: "group-ice",
        callId: this.callId,
        senderId: this.currentUserId,
        recipientId: participantId,
        candidate: event.candidate.toJSON(),
        createdAt: new Date().toISOString(),
      }).catch((caught) => {
        this.reportError(
          participantId,
          toError(caught, "Candidatul ICE nu a putut fi trimis."),
        );
      });
    };

    peer.onconnectionstatechange = () => {
      if (entry.closed || this.destroyed) return;
      this.onConnectionStateChange?.(
        participantId,
        normalizeConnectionState(peer),
      );
    };

    peer.onnegotiationneeded = () => {
      if (entry.closed || this.destroyed) return;
      void this.connectToParticipant(participantId);
    };

    this.peers.set(participantId, entry);
    this.onConnectionStateChange?.(participantId, "new");

    return entry;
  }

  private async flushQueuedIce(entry: PeerEntry) {
    if (!entry.peer.remoteDescription || entry.queuedIce.length === 0) return;

    const queued = [...entry.queuedIce];
    entry.queuedIce = [];

    for (const candidate of queued) {
      await entry.peer.addIceCandidate(candidate);
    }
  }

  private async replaceTrack(
    kind: "audio" | "video",
    track: MediaStreamTrack | null,
  ) {
    const replacements: Promise<void>[] = [];

    for (const entry of this.peers.values()) {
      const sender = entry.peer
        .getSenders()
        .find((item) => item.track?.kind === kind);

      if (sender) {
        replacements.push(sender.replaceTrack(track));
        continue;
      }

      if (track) {
        const newSender = entry.peer.addTrack(track, this.localStream);
        if (kind === "audio") {
          replacements.push(this.optimizeAudioSender(newSender));
        }
      }
    }

    await Promise.all(replacements);
  }

  private async optimizeAudioSender(sender: RTCRtpSender) {
    try {
      const parameters = sender.getParameters();
      parameters.encodings =
        parameters.encodings?.length > 0 ? parameters.encodings : [{}];

      const encoding = parameters.encodings[0] as RTCRtpEncodingParameters & {
        priority?: "very-low" | "low" | "medium" | "high";
        networkPriority?: "very-low" | "low" | "medium" | "high";
      };

      encoding.maxBitrate = 64000;
      encoding.priority = "high";
      encoding.networkPriority = "high";

      await sender.setParameters(parameters);
    } catch {
      // Optimizarea este opțională. Conferința continuă normal.
    }
  }

  private reportError(participantId: string, error: Error) {
    console.error(
      `Eroare GroupPeerManager pentru participantul ${participantId}:`,
      error,
    );
    this.onError?.(participantId, error);
  }

  private assertUsable() {
    if (this.destroyed) {
      throw new Error("GroupPeerManager a fost deja închis.");
    }
  }
}