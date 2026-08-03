"use client";

import { useCallback, useEffect, useState } from "react";
import { getMessages } from "../services/messages";
import type { MessengerMessage } from "../types";

export default function useConversation(
  conversationId: string
) {
  const [messages, setMessages] = useState<MessengerMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getMessages(conversationId);

      setMessages(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unknown error"
      );
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    messages,
    loading,
    error,
    reload,
    setMessages,
  };
}