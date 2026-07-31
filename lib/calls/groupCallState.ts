import type {
  GroupCallIdentity,
  GroupCallParticipant,
  GroupCallSession,
  GroupParticipantStatus,
} from "./groupCallTypes";
import {
  createGroupCallId,
  nowIso,
  shouldEndConference,
  upsertParticipant,
} from "./groupCallUtils";

export function createParticipant(
  identity: GroupCallIdentity,
  status: GroupParticipantStatus = "connected",
): GroupCallParticipant {
  return {
    userId: identity.userId,
    name: identity.name,
    avatarUrl: identity.avatarUrl ?? null,
    status,
    joinedAt: nowIso(),
    leftAt: null,
    isMuted: false,
    isCameraOff: false,
  };
}

export function createSession(params: {
  conversationId: number;
  kind: GroupCallSession["kind"];
  identity: GroupCallIdentity;
}): GroupCallSession {
  return {
    id: createGroupCallId(),
    conversationId: params.conversationId,
    kind: params.kind,
    status: "active",
    createdAt: nowIso(),
    endedAt: null,
    participants: [createParticipant(params.identity)],
  };
}

export function joinSession(
  session: GroupCallSession,
  identity: GroupCallIdentity,
): GroupCallSession {
  const existing = session.participants.find(
    (participant) => participant.userId === identity.userId,
  );

  const nextParticipant: GroupCallParticipant = existing
    ? {
        ...existing,
        name: identity.name,
        avatarUrl: identity.avatarUrl ?? existing.avatarUrl,
        status: "connected",
        joinedAt: nowIso(),
        leftAt: null,
      }
    : createParticipant(identity);

  return {
    ...session,
    status: "active",
    endedAt: null,
    participants: upsertParticipant(session.participants, nextParticipant),
  };
}

export function setParticipantStatus(
  session: GroupCallSession,
  userId: string,
  status: GroupParticipantStatus,
): GroupCallSession {
  const changedAt = nowIso();

  const participants = session.participants.map((participant) =>
    participant.userId === userId
      ? {
          ...participant,
          status,
          leftAt: status === "left" ? changedAt : null,
        }
      : participant,
  );

  const nextSession: GroupCallSession = {
    ...session,
    participants,
  };

  if (!shouldEndConference(nextSession)) return nextSession;

  return {
    ...nextSession,
    status: "ended",
    endedAt: changedAt,
  };
}

export function setParticipantMuted(
  session: GroupCallSession,
  userId: string,
  isMuted: boolean,
): GroupCallSession {
  return {
    ...session,
    participants: session.participants.map((participant) =>
      participant.userId === userId
        ? { ...participant, isMuted }
        : participant,
    ),
  };
}

export function setParticipantCameraOff(
  session: GroupCallSession,
  userId: string,
  isCameraOff: boolean,
): GroupCallSession {
  return {
    ...session,
    participants: session.participants.map((participant) =>
      participant.userId === userId
        ? { ...participant, isCameraOff }
        : participant,
    ),
  };
}
