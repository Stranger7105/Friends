export type CallKind = "audio" | "video";
export type CallMode = "direct" | "conference";

export type CallStatus =
  | "idle"
  | "calling"
  | "ringing"
  | "connecting"
  | "active"
  | "rejected"
  | "ended"
  | "failed";

export type CallContact = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type ConferenceParticipantStatus =
  | "invited"
  | "joining"
  | "connected"
  | "left"
  | "rejected"
  | "failed";

export type ConferenceParticipant = CallContact & {
  status: ConferenceParticipantStatus;
  isHost: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
  stream: MediaStream | null;
};

export type ConferenceInvite = {
  callId: string;
  conversationId: number;
  host: CallContact;
  kind: CallKind;
  participants: CallContact[];
};

type DirectCallSignal =
  | {
      type: "call-invite";
      callId: string;
      conversationId: number;
      callerId: string;
      calleeId: string;
      kind: CallKind;
      callerName: string;
      callerAvatarUrl: string | null;
      offer: RTCSessionDescriptionInit;
      createdAt: string;
    }
  | {
      type: "call-answer";
      callId: string;
      senderId: string;
      recipientId: string;
      answer: RTCSessionDescriptionInit;
      createdAt: string;
    }
  | {
      type: "call-ice";
      callId: string;
      senderId: string;
      recipientId: string;
      candidate: RTCIceCandidateInit;
      createdAt: string;
    }
  | {
      type: "call-reject" | "call-cancel" | "call-end";
      callId: string;
      senderId: string;
      recipientId: string;
      createdAt: string;
    };

type ConferenceCallSignal =
  | {
      type: "conference-invite";
      callId: string;
      conversationId: number;
      hostId: string;
      recipientId: string;
      kind: CallKind;
      hostName: string;
      hostAvatarUrl: string | null;
      participants: CallContact[];
      createdAt: string;
    }
  | {
      type: "conference-join";
      callId: string;
      senderId: string;
      recipientId: string;
      participant: CallContact;
      createdAt: string;
    }
  | {
      type: "conference-offer";
      callId: string;
      senderId: string;
      recipientId: string;
      participant: CallContact;
      offer: RTCSessionDescriptionInit;
      createdAt: string;
    }
  | {
      type: "conference-answer";
      callId: string;
      senderId: string;
      recipientId: string;
      answer: RTCSessionDescriptionInit;
      createdAt: string;
    }
  | {
      type: "conference-ice";
      callId: string;
      senderId: string;
      recipientId: string;
      candidate: RTCIceCandidateInit;
      createdAt: string;
    }
  | {
      type: "conference-participant-state";
      callId: string;
      senderId: string;
      recipientId: string;
      isMuted: boolean;
      isCameraOff: boolean;
      createdAt: string;
    }
  | {
      type: "conference-reject" | "conference-leave" | "conference-end";
      callId: string;
      senderId: string;
      recipientId: string;
      createdAt: string;
    };

export type CallSignal = DirectCallSignal | ConferenceCallSignal;
export type ConferenceSignal = Extract<CallSignal, { type: `conference-${string}` }>;
