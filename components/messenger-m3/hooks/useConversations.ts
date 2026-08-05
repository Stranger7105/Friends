"use client";

import { useCallback, useEffect, useState } from "react";
import { getCurrentUserId } from "../services/auth";
import { getConversations } from "../services/conversations";
import type { MessengerConversation } from "../types";

export default function useConversations() {
  const [conversations, setConversations] = useState<
    MessengerConversation[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const currentUserId = await getCurrentUserId();
      const data = await getConversations(currentUserId);

      setConversations(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Conversațiile nu au putut fi încărcate."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    conversations,
    loading,
    error,
    reload: load,
  };
}
