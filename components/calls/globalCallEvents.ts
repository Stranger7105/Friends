"use client";

import type { CallContact, CallKind } from "./callTypes";

export const FRIENDS_START_CALL_EVENT = "friends:start-global-call";
export const FRIENDS_START_CONFERENCE_EVENT = "friends:start-global-conference";

export type GlobalCallRequest = {
  contact: CallContact;
  conversationId: number;
  kind: CallKind;
};

export function requestGlobalCall(request: GlobalCallRequest) {
  window.dispatchEvent(
    new CustomEvent<GlobalCallRequest>(FRIENDS_START_CALL_EVENT, {
      detail: request,
    }),
  );
}

export type GlobalConferenceRequest = {
  conversationId: number;
  kind: CallKind;
  invitees: CallContact[];
};

export function requestGlobalConference(request: GlobalConferenceRequest) {
  window.dispatchEvent(
    new CustomEvent<GlobalConferenceRequest>(FRIENDS_START_CONFERENCE_EVENT, {
      detail: request,
    }),
  );
}
