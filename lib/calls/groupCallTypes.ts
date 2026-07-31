export const GROUP_CALL_MAX_PARTICIPANTS = 10 as const;

export type GroupCallKind = "audio" | "video";

export type GroupCallStatus =
  | "idle"
  | "creating"
  | "joining"
  | "active"
  | "ending"
  | "ended"
  | "failed";

export type GroupParticipantStatus =
  | "joining"
  | "connected"
  | "reconnecting"
  | "left";

export type GroupCallParticipant = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  status: GroupParticipantStatus;
  joinedAt: string;
  leftAt: string | null;
  isMuted: boolean;
  isCameraOff: boolean;
};

export type GroupCallSession = {
  id: string;
  conversationId: number;
  kind: GroupCallKind;
  status: "active" | "ended";
  createdAt: string;
  endedAt: string | null;
  participants: GroupCallParticipant[];
};

export type GroupCallIdentity = {
  userId: string;
  name: string;
  avatarUrl?: string | null;
};

export type CreateGroupCallInput = {
  conversationId: number;
  kind: GroupCallKind;
  identity: GroupCallIdentity;
};

export type JoinGroupCallInput = {
  conferenceId: string;
  identity: GroupCallIdentity;
};

export type GroupCallLeaveReason =
  | "user-left"
  | "conference-ended"
  | "connection-lost";
