"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

type UseRealtimeProps = {
  conversationId: string;
  onNewMessage: () => void;
};

export default function useRealtime({
  conversationId,
  onNewMessage,
}: UseRealtimeProps) {
  useEffect(() => {
    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          onNewMessage();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, onNewMessage]);
}