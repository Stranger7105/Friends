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
      type: "call-accept" | "call-reject" | "call-cancel" | "call-end";
      callId: string;
      senderId: string;
      createdAt: string;
    };

export type CallProfile = {
  id: string;
  name: string;
  avatarUrl: string | null;
};
