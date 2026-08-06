import { supabase } from "@/lib/supabase";
import type { MessageReaction } from "../types";

type DatabaseReaction = {
  id: number;
  message_id: number;
  user_id: string;
  emoji: string;
  created_at: string;
};

function parseMessageId(messageId: string): number {
  const numericId = Number(messageId);

  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new Error("Identificatorul mesajului nu este valid.");
  }

  return numericId;
}

function mapDatabaseReaction(
  row: DatabaseReaction
): MessageReaction {
  return {
    id: String(row.id),
    userId: row.user_id,
    emoji: row.emoji,
    createdAt: row.created_at,
  };
}

export async function getReactionsForMessages(
  messageIds: string[]
): Promise<Map<string, MessageReaction[]>> {
  const numericIds = messageIds
    .map(Number)
    .filter(
      (value) => Number.isInteger(value) && value > 0
    );

  const reactionsByMessage = new Map<
    string,
    MessageReaction[]
  >();

  if (numericIds.length === 0) {
    return reactionsByMessage;
  }

  const { data, error } = await supabase
    .from("message_reactions")
    .select("id, message_id, user_id, emoji, created_at")
    .in("message_id", numericIds)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(
      `Reacțiile nu au putut fi încărcate: ${error.message}`
    );
  }

  for (const row of (data ?? []) as DatabaseReaction[]) {
    const messageId = String(row.message_id);
    const current = reactionsByMessage.get(messageId) ?? [];

    current.push(mapDatabaseReaction(row));
    reactionsByMessage.set(messageId, current);
  }

  return reactionsByMessage;
}

export async function setMessageReaction(
  messageId: string,
  userId: string,
  emoji: string
): Promise<MessageReaction | null> {
  const numericMessageId = parseMessageId(messageId);
  const normalizedEmoji = emoji.trim();

  if (!userId) {
    throw new Error("Utilizatorul nu este autentificat.");
  }

  if (!normalizedEmoji) {
    throw new Error("Reacția nu este validă.");
  }

  const { data: existingData, error: existingError } =
    await supabase
      .from("message_reactions")
      .select("id, message_id, user_id, emoji, created_at")
      .eq("message_id", numericMessageId)
      .eq("user_id", userId)
      .maybeSingle();

  if (existingError) {
    throw new Error(
      `Reacția existentă nu a putut fi verificată: ${existingError.message}`
    );
  }

  const existing = existingData as DatabaseReaction | null;

  if (existing?.emoji === normalizedEmoji) {
    const { error: deleteError } = await supabase
      .from("message_reactions")
      .delete()
      .eq("id", existing.id);

    if (deleteError) {
      throw new Error(
        `Reacția nu a putut fi eliminată: ${deleteError.message}`
      );
    }

    return null;
  }

  if (existing) {
    const { data, error } = await supabase
      .from("message_reactions")
      .update({ emoji: normalizedEmoji })
      .eq("id", existing.id)
      .select("id, message_id, user_id, emoji, created_at")
      .single();

    if (error) {
      throw new Error(
        `Reacția nu a putut fi schimbată: ${error.message}`
      );
    }

    return mapDatabaseReaction(data as DatabaseReaction);
  }

  const { data, error } = await supabase
    .from("message_reactions")
    .insert({
      message_id: numericMessageId,
      user_id: userId,
      emoji: normalizedEmoji,
    })
    .select("id, message_id, user_id, emoji, created_at")
    .single();

  if (error) {
    throw new Error(
      `Reacția nu a putut fi salvată: ${error.message}`
    );
  }

  return mapDatabaseReaction(data as DatabaseReaction);
}
