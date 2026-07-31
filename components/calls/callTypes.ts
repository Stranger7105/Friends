export type CallKind = "audio" | "video";

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

export type CallSignal =
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
