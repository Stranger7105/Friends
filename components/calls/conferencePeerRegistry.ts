"use client";

import type {
  ConferenceParticipant,
  ConferenceParticipantStatus,
} from "./callTypes";

export type ConferencePeerEntry = {
  participant: ConferenceParticipant;
  peer: RTCPeerConnection;
  pendingIce: RTCIceCandidateInit[];
  remoteStream: MediaStream;
};

export type ConferencePeerSnapshot = {
  participantId: string;
  status: ConferenceParticipantStatus;
  connectionState: RTCPeerConnectionState;
  iceConnectionState: RTCIceConnectionState;
  signalingState: RTCSignalingState;
  hasAudio: boolean;
  hasVideo: boolean;
};

type CreatePeerInput = {
  participant: ConferenceParticipant;
  configuration: RTCConfiguration;
  localStream: MediaStream | null;
  onIceCandidate: (
    participantId: string,
    candidate: RTCIceCandidateInit
  ) => void | Promise<void>;
  onRemoteStream: (
    participantId: string,
    stream: MediaStream
  ) => void;
  onConnectionStateChange?: (
    participantId: string,
    state: RTCPeerConnectionState
  ) => void;
};

function addLocalTracks(
  peer: RTCPeerConnection,
  localStream: MediaStream | null
) {
  if (!localStream) return;

  for (const track of localStream.getTracks()) {
    const alreadyAdded = peer
      .getSenders()
      .some((sender) => sender.track?.id === track.id);

    if (!alreadyAdded) {
      peer.addTrack(track, localStream);
    }
  }
}

export class ConferencePeerRegistry {
  private readonly peers = new Map<string, ConferencePeerEntry>();

  get size() {
    return this.peers.size;
  }

  has(participantId: string) {
    return this.peers.has(participantId);
  }

  get(participantId: string) {
    return this.peers.get(participantId) ?? null;
  }

  values() {
    return Array.from(this.peers.values());
  }

  participantIds() {
    return Array.from(this.peers.keys());
  }

  create({
    participant,
    configuration,
    localStream,
    onIceCandidate,
    onRemoteStream,
    onConnectionStateChange,
  }: CreatePeerInput) {
    this.close(participant.id);

    const peer = new RTCPeerConnection(configuration);
    const remoteStream = new MediaStream();

    addLocalTracks(peer, localStream);

    peer.onicecandidate = (event) => {
      if (!event.candidate) return;
      void onIceCandidate(participant.id, event.candidate.toJSON());
    };

    peer.ontrack = (event) => {
      const incomingTracks =
        event.streams[0]?.getTracks() ?? [event.track];

      for (const track of incomingTracks) {
        const exists = remoteStream
          .getTracks()
          .some((currentTrack) => currentTrack.id === track.id);

        if (!exists) remoteStream.addTrack(track);
      }

      onRemoteStream(
        participant.id,
        new MediaStream(remoteStream.getTracks())
      );
    };

    peer.onconnectionstatechange = () => {
      onConnectionStateChange?.(
        participant.id,
        peer.connectionState
      );
    };

    const entry: ConferencePeerEntry = {
      participant,
      peer,
      pendingIce: [],
      remoteStream,
    };

    this.peers.set(participant.id, entry);
    return entry;
  }

  updateParticipant(
    participantId: string,
    values: Partial<ConferenceParticipant>
  ) {
    const entry = this.peers.get(participantId);
    if (!entry) return null;

    entry.participant = {
      ...entry.participant,
      ...values,
    };

    return entry.participant;
  }

  queueIce(
    participantId: string,
    candidate: RTCIceCandidateInit
  ) {
    const entry = this.peers.get(participantId);
    if (!entry) return false;

    entry.pendingIce.push(candidate);
    return true;
  }

  async addIce(
    participantId: string,
    candidate: RTCIceCandidateInit
  ) {
    const entry = this.peers.get(participantId);
    if (!entry) return false;

    if (!entry.peer.remoteDescription) {
      entry.pendingIce.push(candidate);
      return true;
    }

    await entry.peer.addIceCandidate(candidate);
    return true;
  }

  async flushIce(participantId: string) {
    const entry = this.peers.get(participantId);
    if (!entry?.peer.remoteDescription) return;

    const queued = [...entry.pendingIce];
    entry.pendingIce = [];

    for (const candidate of queued) {
      await entry.peer.addIceCandidate(candidate);
    }
  }

  replaceLocalTrack(
    kind: "audio" | "video",
    track: MediaStreamTrack | null
  ) {
    const operations = this.values().map(async ({ peer }) => {
      const sender = peer
        .getSenders()
        .find((currentSender) => currentSender.track?.kind === kind);

      if (sender) {
        await sender.replaceTrack(track);
      }
    });

    return Promise.allSettled(operations);
  }

  syncLocalStream(localStream: MediaStream | null) {
    for (const { peer } of this.peers.values()) {
      addLocalTracks(peer, localStream);
    }
  }

  snapshot(): ConferencePeerSnapshot[] {
    return this.values().map(({ participant, peer, remoteStream }) => ({
      participantId: participant.id,
      status: participant.status,
      connectionState: peer.connectionState,
      iceConnectionState: peer.iceConnectionState,
      signalingState: peer.signalingState,
      hasAudio: remoteStream.getAudioTracks().length > 0,
      hasVideo: remoteStream.getVideoTracks().length > 0,
    }));
  }

  close(participantId: string) {
    const entry = this.peers.get(participantId);
    if (!entry) return;

    entry.peer.onicecandidate = null;
    entry.peer.ontrack = null;
    entry.peer.onconnectionstatechange = null;
    entry.peer.close();

    for (const track of entry.remoteStream.getTracks()) {
      track.stop();
    }

    this.peers.delete(participantId);
  }

  closeAll() {
    for (const participantId of this.participantIds()) {
      this.close(participantId);
    }
  }
}

export function createConferenceParticipant(
  participant: Pick<ConferenceParticipant, "id" | "name" | "avatarUrl"> &
    Partial<
      Pick<
        ConferenceParticipant,
        | "status"
        | "isHost"
        | "isMuted"
        | "isCameraOff"
        | "stream"
      >
    >
): ConferenceParticipant {
  return {
    id: participant.id,
    name: participant.name,
    avatarUrl: participant.avatarUrl,
    status: participant.status ?? "invited",
    isHost: participant.isHost ?? false,
    isMuted: participant.isMuted ?? false,
    isCameraOff: participant.isCameraOff ?? false,
    stream: participant.stream ?? null,
  };
}
