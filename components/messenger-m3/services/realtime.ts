import { supabase } from "@/lib/supabase";
import type { MessengerMessage } from "../types";
import {
  mapDatabaseMessage,
  type DatabaseMessage,
} from "./messageMapper";

type ConversationRealtimeHandlers = {
  onInsert: (message: MessengerMessage) => void;
  onUpdate: (message: MessengerMessage) => void;
};

export function subscribeToConversationMessages(
  conversationId: string,
  handlers: ConversationRealtimeHandlers
): () => void {
  const channel = supabase
    .channel(`messenger-m3-conversation-${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload: { new: unknown }) => {
        handlers.onInsert(
          mapDatabaseMessage(payload.new as DatabaseMessage)
        );
      }
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload: { new: unknown }) => {
        handlers.onUpdate(
          mapDatabaseMessage(payload.new as DatabaseMessage)
        );
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
