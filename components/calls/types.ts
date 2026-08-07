export type CallKind = "audio" | "video";

/**
 * Compatibilitate:
 * - M2/M3 call manager folosește idle/calling/connecting/active/failed.
 * - M4.1A persistent signaling folosește accepted/cancelled.
 * Păstrăm toate stările până când motorul vechi este retras complet.
 */
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

/**
 * Tipurile legacy sunt încă importate de CallOverlay/useCallManager.
 */
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

/**
 * M4.1A persistent call session.
 * DB-ul M4.1A produce doar ringing/accepted/rejected/cancelled/ended,
 * dar CallStatus rămâne superset pentru compatibilitate.
 */
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
