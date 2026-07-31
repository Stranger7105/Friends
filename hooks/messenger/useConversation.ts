"use client";

import { useMemo } from "react";
import { useMessengerContext } from "@/contexts/MessengerContext";

export function useConversation(conversationId?: string | null) {
  const {
    activeConversationId,
    conversations,
    setActiveConversationId,
  } = useMessengerContext();

  const resolvedId = conversationId ?? activeConversationId;

  const conversation = useMemo(
    () =>
      resolvedId
        ? conversations.find((item) => item.id === resolvedId) ?? null
        : null,
    [conversations, resolvedId]
  );

  return {
    conversation,
    conversationId: resolvedId,
    setActiveConversationId,
  };
}
