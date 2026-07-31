"use client";

import { useCallContext } from "@/contexts/CallContext";
import type { CallKind, MessengerCall } from "@/types/messenger";

export function useCalls() {
  const { activeCall, setActiveCall, endCallLocally } = useCallContext();

  function prepareCall(
    conversationId: string,
    createdBy: string,
    kind: CallKind
  ): MessengerCall {
    const call: MessengerCall = {
      id: crypto.randomUUID(),
      conversationId,
      createdBy,
      kind,
      status: "connecting",
      startedAt: null,
      endedAt: null,
    };

    setActiveCall(call);
    return call;
  }

  return {
    activeCall,
    prepareCall,
    setActiveCall,
    endCallLocally,
  };
}
