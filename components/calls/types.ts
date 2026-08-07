export type CallKind = "audio" | "video";

export type CallStatus =
  | "idle"
  | "calling"
  | "ringing"
  | "connecting"
  | "active"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "ended"
  | "failed";

export type CallDirection = "incoming" | "outgoing";

export type CallConnectionState =
  | "idle"
  | "preparing"
  | "connecting"
  | "connected"
  | "failed";

export type CallProfile = {
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
      createdAt: string;
    }
  | {
      type:
        | "call-accept"
        | "call-reject"
        | "call-cancel"
        | "call-end";
      callId: string;
      senderId: string;
      createdAt: string;
    };

export type CallSessionRow = {
  id: string;
  conversation_id: number;
  caller_id: string;
  callee_id: string;
  kind: CallKind;
  status: CallStatus;
  created_at: string;
  accepted_at: string | null;
  ended_at: string | null;
  updated_at: string;
};

export type ActiveCall = {
  id: string;
  conversationId: string;
  callerId: string;
  calleeId: string;
  kind: CallKind;
  status: CallStatus;
  direction: CallDirection;
  peerId: string;
  peerName: string;
  peerAvatarUrl?: string;
  createdAt: string;
  acceptedAt?: string;
  endedAt?: string;
};

export type StartCallTarget = {
  conversationId: string;
  userId: string;
  fullName: string;
  avatarUrl?: string;
};

export type WebRtcSignalType = "offer" | "answer" | "ice";

export type CallSignalRow = {
  id: number;
  call_id: string;
  sender_id: string;
  recipient_id: string;
  signal_type: WebRtcSignalType;
  payload: Record<string, unknown>;
  created_at: string;
};
