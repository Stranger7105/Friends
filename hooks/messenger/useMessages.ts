"use client";

import { useMemo } from "react";
import { useMessengerContext } from "@/contexts/MessengerContext";
import { useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useEffect } from "react";

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
  const loadMessages = useCallback(async () => {
  if (!conversationId) return;

  const conversation = Number(conversationId);

  if (!Number.isFinite(conversation)) return;

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversation)
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    console.error(error);
    return;
  }

  replaceMessages(
    conversationId,
    (data ?? []).map((message: any) => ({
      id: String(message.id),
      conversationId: String(message.conversation_id),
      senderId: message.sender_id,
      kind: "text",
      text: message.content ?? "",
      attachments: [],
      replyToId: null,
      editedAt: message.edited_at,
      createdAt: message.created_at,
      status: message.seen_at
  ? "read"
  : message.delivered_at
  ? "delivered"
  : "sent",
    }))
  );
}, [conversationId, replaceMessages]);
const markConversationAsSeen = useCallback(async () => {
  if (!conversationId) return;

  const conversation = Number(conversationId);

  if (!Number.isFinite(conversation)) return;

  await supabase
    .from("messages")
    .update({
      seen_at: new Date().toISOString(),
    })
    .eq("conversation_id", conversation)
    .is("seen_at", null);
}, [conversationId]);
useEffect(() => {
  if (!conversationId) return;

  const conversation = Number(conversationId);

  if (!Number.isFinite(conversation)) return;

  const channel = supabase
    .channel(`messages-${conversation}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversation}`,
      },
      (payload) => {
  if (payload.eventType === "UPDATE") {
    const message = payload.new as any;

    updateMessage(
  String(message.conversation_id),
  String(message.id),
  {
    status: message.seen_at
      ? "read"
      : message.delivered_at
      ? "delivered"
      : "sent",
    editedAt: message.edited_at,
  }
);

    return;
  }

  if (payload.eventType !== "INSERT") {
    return;
  }

        const message = payload.new as any;

        appendMessage({
          id: String(message.id),
          conversationId: String(message.conversation_id),
          senderId: message.sender_id,
          kind: "text",
          text: message.content ?? "",
          attachments: [],
          replyToId: null,
          editedAt: message.edited_at,
          createdAt: message.created_at,
          status: message.seen_at
  ? "read"
  : message.delivered_at
  ? "delivered"
  : "sent",
        });
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}, [conversationId, appendMessage]);

  return {
    messages,
    replaceMessages,
    appendMessage,
    updateMessage,
    removeMessage,
    loadMessages,
  };
}
