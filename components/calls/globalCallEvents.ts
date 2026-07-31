"use client";

import type { CallContact, CallKind } from "./callTypes";

export const FRIENDS_START_CALL_EVENT = "friends:start-global-call";

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
