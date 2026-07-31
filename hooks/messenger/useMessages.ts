"use client";

import { useMemo } from "react";
import { useMessengerContext } from "@/contexts/MessengerContext";

export function useMessages(conversationId: string | null) {
  const {
    messagesByConversation,
    replaceMessages,
    appendMessage,
    updateMessage,
    removeMessage,
  } = useMessengerContext();

  const messages = useMemo(
    () => (conversationId ? messagesByConversation[conversationId] ?? [] : []),
    [conversationId, messagesByConversation]
  );

  return {
    messages,
    replaceMessages,
    appendMessage,
    updateMessage,
    removeMessage,
  };
}
