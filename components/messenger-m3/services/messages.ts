import { supabase } from "@/lib/supabase";
import { notifyNotificationCountsChanged } from "@/lib/notificationEvents";
import type { MessengerMessage } from "../types";
import {
  MESSAGE_SELECT,
  mapDatabaseMessage,
  type DatabaseMessage,
} from "./messageMapper";
import { getHiddenMessageIds } from "./deletions";

function parseConversationId(conversationId: string): number {
  const numericId = Number(conversationId);

  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new Error("Identificatorul conversației nu este valid.");
  }

  return numericId;
}

function parseReplyId(replyToId?: string): number | null {
  if (!replyToId) return null;

  const numericId = Number(replyToId);

  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new Error("Mesajul la care răspunzi nu este valid.");
  }

  return numericId;
}

export async function getMessages(
  conversationId: string,
  currentUserId: string
): Promise<MessengerMessage[]> {
  const numericConversationId = parseConversationId(conversationId);

  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_SELECT)
    .eq("conversation_id", numericConversationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(
      `Mesajele nu au putut fi încărcate: ${error.message}`
    );
  }

  const mappedMessages =
    ((data ?? []) as DatabaseMessage[]).map(
      mapDatabaseMessage
    );

  const hiddenMessageIds = await getHiddenMessageIds(
    currentUserId,
    mappedMessages.map((message) => message.id)
  );

  return mappedMessages.filter(
    (message) => !hiddenMessageIds.has(message.id)
  );
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  text: string,
  replyToId?: string
): Promise<MessengerMessage> {
  const numericConversationId = parseConversationId(conversationId);
  const numericReplyToId = parseReplyId(replyToId);
  const content = text.trim();

  if (!senderId) {
    throw new Error("Utilizatorul nu este autentificat.");
  }

  if (!content) {
    throw new Error("Mesajul este gol.");
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: numericConversationId,
      sender_id: senderId,
      content,
      reply_to_message_id: numericReplyToId,
    })
    .select(MESSAGE_SELECT)
    .single();

  if (error) {
    throw new Error(
      `Mesajul nu a putut fi trimis: ${error.message}`
    );
  }

  return mapDatabaseMessage(data as DatabaseMessage);
}

export async function markConversationSeen(
  conversationId: string,
  currentUserId: string
): Promise<string> {
  const numericConversationId = parseConversationId(conversationId);

  if (!currentUserId) {
    throw new Error("Utilizatorul nu este autentificat.");
  }

  const seenAt = new Date().toISOString();

  const { error } = await supabase
    .from("messages")
    .update({ seen_at: seenAt })
    .eq("conversation_id", numericConversationId)
    .neq("sender_id", currentUserId)
    .is("seen_at", null);

  if (error) {
    throw new Error(
      `Mesajele nu au putut fi marcate ca văzute: ${error.message}`
    );
  }

  const { data: conversationMessages } = await supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", numericConversationId)
    .neq("sender_id", currentUserId);

  const messageIds = (conversationMessages ?? [])
    .map((row) => Number(row.id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (messageIds.length > 0) {
    const { error: notificationError } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_id", currentUserId)
      .eq("type", "message")
      .eq("is_read", false)
      .in("message_id", messageIds);

    if (notificationError) {
      console.error(
        `Notificările mesajelor nu au putut fi marcate: ${notificationError.message}`
      );
    }
  }

  notifyNotificationCountsChanged();
  return seenAt;
}

export async function editMessage(
  messageId: string,
  currentUserId: string,
  text: string
): Promise<MessengerMessage> {
  const numericMessageId = Number(messageId);
  const content = text.trim();

  if (!Number.isInteger(numericMessageId) || numericMessageId <= 0) {
    throw new Error("Mesajul selectat nu este valid.");
  }

  if (!currentUserId) {
    throw new Error("Utilizatorul nu este autentificat.");
  }

  if (!content) {
    throw new Error("Mesajul editat nu poate fi gol.");
  }

  const editedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("messages")
    .update({
      content,
      edited_at: editedAt,
    })
    .eq("id", numericMessageId)
    .eq("sender_id", currentUserId)
    .select(MESSAGE_SELECT)
    .single();

  if (error) {
    throw new Error(
      `Mesajul nu a putut fi editat: ${error.message}`
    );
  }

  return mapDatabaseMessage(data as DatabaseMessage);
}
