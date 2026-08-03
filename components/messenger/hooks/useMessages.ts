"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { MessengerMessage } from "@/types/messenger";

type DatabaseMessage = {
  id: number;
  conversation_id: number;
  sender_id: string;
  content: string | null;
  created_at: string;
  seen_at: string | null;
  edited_at: string | null;
  reply_to_message_id: number | null;
};

type UseMessagesOptions = {
  conversationId: string | null;
  currentUserId: string;
};

function mapDatabaseMessage(row: DatabaseMessage): MessengerMessage {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    senderId: row.sender_id,
    kind: "text",
    text: row.content ?? "",
    attachments: [],
    replyToId:
      row.reply_to_message_id !== null
        ? String(row.reply_to_message_id)
        : null,
    editedAt: row.edited_at,
    createdAt: row.created_at,
    status: row.seen_at ? "read" : "sent",
  };
}

export default function useMessages({
  conversationId,
  currentUserId,
}: UseMessagesOptions) {
  const [messages, setMessages] = useState<MessengerMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const markConversationAsSeen = useCallback(async () => {
    if (!conversationId || !currentUserId) return;
    if (document.visibilityState !== "visible") return;

    const numericConversationId = Number(conversationId);
    if (!Number.isFinite(numericConversationId)) return;

    const { error: seenError } = await supabase
      .from("messages")
      .update({ seen_at: new Date().toISOString() })
      .eq("conversation_id", numericConversationId)
      .neq("sender_id", currentUserId)
      .is("seen_at", null);

    if (seenError) {
      console.error(
        "Mesajele nu au putut fi marcate ca văzute:",
        seenError.message
      );
    }
  }, [conversationId, currentUserId]);

  const loadMessages = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    const numericConversationId = Number(conversationId);

    if (!Number.isFinite(numericConversationId)) {
      setMessages([]);
      setError("Identificatorul conversației nu este valid.");
      return;
    }

    setLoading(true);
    setError("");

    const { data, error: loadError } = await supabase
      .from("messages")
      .select(
        "id, conversation_id, sender_id, content, created_at, seen_at, edited_at, reply_to_message_id"
      )
      .eq("conversation_id", numericConversationId)
      .order("id", { ascending: true });

    if (loadError) {
      setError(`Mesajele nu au putut fi încărcate: ${loadError.message}`);
      setLoading(false);
      return;
    }

    setMessages(((data ?? []) as DatabaseMessage[]).map(mapDatabaseMessage));
    setLoading(false);

    await markConversationAsSeen();
  }, [conversationId, markConversationAsSeen]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void markConversationAsSeen();
      }
    }

    function handleWindowFocus() {
      void markConversationAsSeen();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [markConversationAsSeen]);

  useEffect(() => {
    if (!conversationId) return;

    const numericConversationId = Number(conversationId);
    if (!Number.isFinite(numericConversationId)) return;

    const channel = supabase
      .channel(`messenger-m2-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${numericConversationId}`,
        },
        (payload) => {
          const incoming = mapDatabaseMessage(
            payload.new as DatabaseMessage
          );

          setMessages((current) => {
            if (current.some((message) => message.id === incoming.id)) {
              return current;
            }

            return [...current, incoming];
          });

          if (incoming.senderId !== currentUserId) {
            void markConversationAsSeen();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${numericConversationId}`,
        },
        (payload) => {
          const updated = mapDatabaseMessage(
            payload.new as DatabaseMessage
          );

          setMessages((current) =>
            current.map((message) =>
              message.id === updated.id ? updated : message
            )
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId, markConversationAsSeen]);

  const sendMessage = useCallback(
    async (text: string, replyToId: string | null = null) => {
      const content = text.trim();

      if (!content || !conversationId || !currentUserId || sending) {
        return false;
      }

      const numericConversationId = Number(conversationId);

      if (!Number.isFinite(numericConversationId)) {
        setError("Identificatorul conversației nu este valid.");
        return false;
      }

      const numericReplyToId =
        replyToId !== null ? Number(replyToId) : null;

      if (
        numericReplyToId !== null &&
        !Number.isFinite(numericReplyToId)
      ) {
        setError("Mesajul la care răspunzi nu este valid.");
        return false;
      }

      setSending(true);
      setError("");

      const optimisticId = `temporary-${crypto.randomUUID()}`;

      const optimisticMessage: MessengerMessage = {
        id: optimisticId,
        conversationId,
        senderId: currentUserId,
        kind: "text",
        text: content,
        attachments: [],
        replyToId,
        editedAt: null,
        createdAt: new Date().toISOString(),
        status: "sending",
      };

      setMessages((current) => [...current, optimisticMessage]);

      const { data, error: sendError } = await supabase
        .from("messages")
        .insert({
          conversation_id: numericConversationId,
          sender_id: currentUserId,
          content,
          reply_to_message_id: numericReplyToId,
        })
        .select(
          "id, conversation_id, sender_id, content, created_at, seen_at, edited_at, reply_to_message_id"
        )
        .single();

      if (sendError) {
        setMessages((current) =>
          current.filter((message) => message.id !== optimisticId)
        );

        setError(`Mesajul nu a putut fi trimis: ${sendError.message}`);
        setSending(false);
        return false;
      }

      const savedMessage = mapDatabaseMessage(data as DatabaseMessage);

      setMessages((current) => {
        const withoutTemporary = current.filter(
          (message) =>
            message.id !== optimisticId &&
            message.id !== savedMessage.id
        );

        return [...withoutTemporary, savedMessage].sort(
          (first, second) =>
            new Date(first.createdAt).getTime() -
            new Date(second.createdAt).getTime()
        );
      });

      setSending(false);
      return true;
    },
    [conversationId, currentUserId, sending]
  );

  return {
    messages,
    loading,
    sending,
    error,
    loadMessages,
    markConversationAsSeen,
    sendMessage,
  };
}