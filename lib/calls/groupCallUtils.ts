import {
  GROUP_CALL_MAX_PARTICIPANTS,
  type GroupCallParticipant,
  type GroupCallSession,
} from "./groupCallTypes";

export function nowIso(): string {
  return new Date().toISOString();
}

export function createGroupCallId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `group-call-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function isPresentParticipant(
  participant: GroupCallParticipant,
): boolean {
  return participant.status !== "left";
}

export function getPresentParticipants(
  session: GroupCallSession,
): GroupCallParticipant[] {
  return session.participants.filter(isPresentParticipant);
}

export function getConnectedParticipants(
  session: GroupCallSession,
): GroupCallParticipant[] {
  return session.participants.filter(
    (participant) => participant.status === "connected",
  );
}

export function isGroupCallFull(session: GroupCallSession): boolean {
  return getPresentParticipants(session).length >= GROUP_CALL_MAX_PARTICIPANTS;
}

export function shouldEndConference(session: GroupCallSession): boolean {
  if (session.status === "ended") return true;

  // Un participant aflat în reconectare este încă membru al conferinței.
  return getPresentParticipants(session).length < 2;
}

export function upsertParticipant(
  participants: GroupCallParticipant[],
  nextParticipant: GroupCallParticipant,
): GroupCallParticipant[] {
  const index = participants.findIndex(
    (participant) => participant.userId === nextParticipant.userId,
  );

  if (index === -1) return [...participants, nextParticipant];

  return participants.map((participant, participantIndex) =>
    participantIndex === index
      ? { ...participant, ...nextParticipant }
      : participant,
  );
}
