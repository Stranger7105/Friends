"use client";

import type {
  CallContact,
  CallKind,
  ConferenceInvite,
  ConferenceParticipant,
  ConferenceSignal,
} from "./callTypes";
import {
  ConferencePeerRegistry,
  createConferenceParticipant,
} from "./conferencePeerRegistry";

type SendSignal = (signal: ConferenceSignal) => Promise<void>;

type ConferenceSessionCallbacks = {
  onInvite: (invite: ConferenceInvite) => void;
  onParticipantsChange: (participants: ConferenceParticipant[]) => void;
  onRemoteStreamsChange: (streams: Map<string, MediaStream>) => void;
  onEnded: () => void;
  onError: (message: string) => void;
};

type ControllerOptions = {
  currentUserId: string;
  currentUser: CallContact;
  configuration: RTCConfiguration;
  sendSignal: SendSignal;
  callbacks: ConferenceSessionCallbacks;
};

export class ConferenceSessionController {
  private readonly registry = new ConferencePeerRegistry();
  private readonly participants = new Map<string, ConferenceParticipant>();
  private readonly pendingIce = new Map<string, RTCIceCandidateInit[]>();
  private localStream: MediaStream | null = null;
  private callId = "";
  private conversationId: number | null = null;
  private kind: CallKind = "audio";
  private hostId = "";
  private active = false;

  constructor(private readonly options: ControllerOptions) {}

  get isActive() {
    return this.active;
  }

  get currentCallId() {
    return this.callId;
  }

  get participantList() {
    return Array.from(this.participants.values());
  }

  setLocalStream(stream: MediaStream | null) {
    this.localStream = stream;
    this.registry.syncLocalStream(stream);
  }

  async start(input: {
    conversationId: number;
    kind: CallKind;
    invitees: CallContact[];
  }) {
    this.reset(false);
    this.callId = crypto.randomUUID();
    this.conversationId = input.conversationId;
    this.kind = input.kind;
    this.hostId = this.options.currentUserId;
    this.active = true;

    this.upsertParticipant({
      ...this.options.currentUser,
      status: "connected",
      isHost: true,
      isMuted: false,
      isCameraOff: input.kind === "audio",
      stream: this.localStream,
    });

    for (const invitee of input.invitees) {
      this.upsertParticipant(createConferenceParticipant({
        ...invitee,
        status: "invited",
      }));

      await this.options.sendSignal({
        type: "conference-invite",
        callId: this.callId,
        conversationId: input.conversationId,
        hostId: this.options.currentUserId,
        recipientId: invitee.id,
        kind: input.kind,
        hostName: this.options.currentUser.name,
        hostAvatarUrl: this.options.currentUser.avatarUrl,
        participants: [this.options.currentUser, ...input.invitees],
        createdAt: new Date().toISOString(),
      });
    }

    return this.callId;
  }

  async accept(invite: ConferenceInvite) {
    this.reset(false);
    this.callId = invite.callId;
    this.conversationId = invite.conversationId;
    this.kind = invite.kind;
    this.hostId = invite.host.id;
    this.active = true;

    for (const contact of invite.participants) {
      this.upsertParticipant(createConferenceParticipant({
        ...contact,
        status: contact.id === this.options.currentUserId ? "connected" : "joining",
        isHost: contact.id === invite.host.id,
      }));
    }

    this.upsertParticipant(createConferenceParticipant({
      ...this.options.currentUser,
      status: "connected",
      isHost: false,
      stream: this.localStream,
    }));

    for (const participant of this.participantList) {
      if (participant.id === this.options.currentUserId) continue;
      await this.options.sendSignal({
        type: "conference-join",
        callId: this.callId,
        senderId: this.options.currentUserId,
        recipientId: participant.id,
        participant: this.options.currentUser,
        createdAt: new Date().toISOString(),
      });
    }
  }

  async reject(invite: ConferenceInvite) {
    await this.options.sendSignal({
      type: "conference-reject",
      callId: invite.callId,
      senderId: this.options.currentUserId,
      recipientId: invite.host.id,
      createdAt: new Date().toISOString(),
    });
  }

  async invite(contact: CallContact) {
    if (!this.active || !this.callId || this.conversationId === null) return;
    this.upsertParticipant(createConferenceParticipant({ ...contact, status: "invited" }));
    await this.options.sendSignal({
      type: "conference-invite",
      callId: this.callId,
      conversationId: this.conversationId,
      hostId: this.hostId,
      recipientId: contact.id,
      kind: this.kind,
      hostName: this.options.currentUser.name,
      hostAvatarUrl: this.options.currentUser.avatarUrl,
      participants: this.participantList.map(({ id, name, avatarUrl }) => ({ id, name, avatarUrl })),
      createdAt: new Date().toISOString(),
    });
  }

  async leave(endForEveryone = false) {
    if (!this.active || !this.callId) return;
    const type = endForEveryone && this.hostId === this.options.currentUserId
      ? "conference-end"
      : "conference-leave";

    const recipients = this.participantList.filter((p) => p.id !== this.options.currentUserId);
    await Promise.allSettled(recipients.map((participant) => this.options.sendSignal({
      type,
      callId: this.callId,
      senderId: this.options.currentUserId,
      recipientId: participant.id,
      createdAt: new Date().toISOString(),
    })));
    this.reset(true);
  }

  async broadcastMediaState(isMuted: boolean, isCameraOff: boolean) {
    if (!this.active || !this.callId) return;
    this.upsertParticipant({
      ...(this.participants.get(this.options.currentUserId) ?? createConferenceParticipant(this.options.currentUser)),
      isMuted,
      isCameraOff,
    });

    await Promise.allSettled(
      this.participantList
        .filter((participant) => participant.id !== this.options.currentUserId)
        .map((participant) => this.options.sendSignal({
          type: "conference-participant-state",
          callId: this.callId,
          senderId: this.options.currentUserId,
          recipientId: participant.id,
          isMuted,
          isCameraOff,
          createdAt: new Date().toISOString(),
        }))
    );
  }

  async handleSignal(signal: ConferenceSignal) {
    if (signal.recipientId !== this.options.currentUserId) return false;

    if (signal.type === "conference-invite") {
      this.options.callbacks.onInvite({
        callId: signal.callId,
        conversationId: signal.conversationId,
        host: {
          id: signal.hostId,
          name: signal.hostName,
          avatarUrl: signal.hostAvatarUrl,
        },
        kind: signal.kind,
        participants: signal.participants,
      });
      return true;
    }

    if (!this.active || signal.callId !== this.callId) return false;

    try {
      if (signal.type === "conference-join") {
        this.upsertParticipant(createConferenceParticipant({
          ...signal.participant,
          status: "joining",
        }));
        await this.createOfferFor(signal.senderId, signal.participant);
        return true;
      }

      if (signal.type === "conference-offer") {
        this.upsertParticipant(createConferenceParticipant({
          ...signal.participant,
          status: "joining",
        }));
        const entry = this.createPeer(signal.senderId, signal.participant);
        await entry.peer.setRemoteDescription(signal.offer);
        await this.flushEarlyIce(signal.senderId);
        const answer = await entry.peer.createAnswer();
        await entry.peer.setLocalDescription(answer);
        await this.options.sendSignal({
          type: "conference-answer",
          callId: this.callId,
          senderId: this.options.currentUserId,
          recipientId: signal.senderId,
          answer,
          createdAt: new Date().toISOString(),
        });
        return true;
      }

      if (signal.type === "conference-answer") {
        const entry = this.registry.get(signal.senderId);
        if (!entry) return true;
        await entry.peer.setRemoteDescription(signal.answer);
        await this.registry.flushIce(signal.senderId);
        await this.flushEarlyIce(signal.senderId);
        return true;
      }

      if (signal.type === "conference-ice") {
        const entry = this.registry.get(signal.senderId);
        if (!entry) {
          const queued = this.pendingIce.get(signal.senderId) ?? [];
          queued.push(signal.candidate);
          this.pendingIce.set(signal.senderId, queued);
        } else {
          await this.registry.addIce(signal.senderId, signal.candidate);
        }
        return true;
      }

      if (signal.type === "conference-participant-state") {
        const participant = this.participants.get(signal.senderId);
        if (participant) {
          this.upsertParticipant({
            ...participant,
            isMuted: signal.isMuted,
            isCameraOff: signal.isCameraOff,
          });
        }
        return true;
      }

      if (signal.type === "conference-reject") {
        const participant = this.participants.get(signal.senderId);
        if (participant) this.upsertParticipant({ ...participant, status: "rejected" });
        return true;
      }

      if (signal.type === "conference-leave") {
        const participant = this.participants.get(signal.senderId);
        if (participant) this.upsertParticipant({ ...participant, status: "left", stream: null });
        this.registry.close(signal.senderId);
        this.emitStreams();
        return true;
      }

      if (signal.type === "conference-end") {
        this.reset(true);
        return true;
      }
    } catch (error) {
      console.error("Conference signal error:", error);
      this.options.callbacks.onError("Conexiunea conferinței nu a putut fi negociată.");
      return true;
    }

    return false;
  }

  reset(notifyEnded: boolean) {
    this.registry.closeAll();
    this.participants.clear();
    this.pendingIce.clear();
    this.callId = "";
    this.conversationId = null;
    this.hostId = "";
    this.active = false;
    this.emitParticipants();
    this.emitStreams();
    if (notifyEnded) this.options.callbacks.onEnded();
  }

  private async createOfferFor(participantId: string, contact: CallContact) {
    const entry = this.createPeer(participantId, contact);
    const offer = await entry.peer.createOffer();
    await entry.peer.setLocalDescription(offer);
    await this.options.sendSignal({
      type: "conference-offer",
      callId: this.callId,
      senderId: this.options.currentUserId,
      recipientId: participantId,
      participant: this.options.currentUser,
      offer,
      createdAt: new Date().toISOString(),
    });
  }

  private createPeer(participantId: string, contact: CallContact) {
    const existing = this.registry.get(participantId);
    if (existing) return existing;

    return this.registry.create({
      participant: createConferenceParticipant({ ...contact, status: "joining" }),
      configuration: this.options.configuration,
      localStream: this.localStream,
      onIceCandidate: async (recipientId, candidate) => {
        await this.options.sendSignal({
          type: "conference-ice",
          callId: this.callId,
          senderId: this.options.currentUserId,
          recipientId,
          candidate,
          createdAt: new Date().toISOString(),
        });
      },
      onRemoteStream: (id, stream) => {
        const participant = this.participants.get(id);
        if (participant) this.upsertParticipant({ ...participant, stream, status: "connected" });
        this.emitStreams();
      },
      onConnectionStateChange: (id, state) => {
        const participant = this.participants.get(id);
        if (!participant) return;
        if (state === "connected") this.upsertParticipant({ ...participant, status: "connected" });
        if (state === "failed") this.upsertParticipant({ ...participant, status: "failed" });
      },
    });
  }

  private async flushEarlyIce(participantId: string) {
    const queued = this.pendingIce.get(participantId) ?? [];
    this.pendingIce.delete(participantId);
    for (const candidate of queued) {
      await this.registry.addIce(participantId, candidate);
    }
    await this.registry.flushIce(participantId);
  }

  private upsertParticipant(participant: ConferenceParticipant) {
    this.participants.set(participant.id, participant);
    this.emitParticipants();
  }

  private emitParticipants() {
    this.options.callbacks.onParticipantsChange(this.participantList);
  }

  private emitStreams() {
    const streams = new Map<string, MediaStream>();
    for (const entry of this.registry.values()) {
      if (entry.remoteStream.getTracks().length > 0) {
        streams.set(entry.participant.id, new MediaStream(entry.remoteStream.getTracks()));
      }
    }
    this.options.callbacks.onRemoteStreamsChange(streams);
  }
}
