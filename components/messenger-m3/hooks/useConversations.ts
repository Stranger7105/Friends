"use client";

import { useEffect, useState } from "react";

import { getConversations } from "../services/messages";
import type { MessengerConversation } from "../types";

export default function useConversations() {
  const [conversations, setConversations] = useState<
    MessengerConversation[]
  >([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        const result = await getConversations();

        setConversations(result);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "A apărut o eroare."
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  return {
    conversations,
    loading,
    error,
  };
}