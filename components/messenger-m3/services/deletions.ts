import { supabase } from "@/lib/supabase";
import type { MessengerMessage } from "../types";
import {
  MESSAGE_SELECT,
  mapDatabaseMessage,
  type DatabaseMessage,
} from "./messageMapper";

function parseMessageId(messageId: string): number {
  const numericId = Number(messageId);

  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new Error("Mesajul selectat nu este valid.");
  }

  return numericId;
}

export async function getHiddenMessageIds(
  currentUserId: string,
  messageIds: string[]
): Promise<Set<string>> {
  if (!currentUserId || messageIds.length === 0) {
    return new Set();
  }

  const numericIds = messageIds
    .map(Number)
    .filter(
      (value) => Number.isInteger(value) && value > 0
    );

  if (numericIds.length === 0) {
    return new Set();
  }

  const { data, error } = await supabase
    .from("message_hidden_for_users")
    .select("message_id")
    .eq("user_id", currentUserId)
    .in("message_id", numericIds);

  if (error) {
    throw new Error(
      `Mesajele ascunse nu au putut fi încărcate: ${error.message}`
    );
  }

  return new Set(
    (data ?? []).map((row) => String(row.message_id))
  );
}

export async function deleteMessageForMe(
  messageId: string,
  currentUserId: string
): Promise<void> {
  const numericMessageId = parseMessageId(messageId);

  if (!currentUserId) {
    throw new Error("Utilizatorul nu este autentificat.");
  }

  const { error } = await supabase
    .from("message_hidden_for_users")
    .upsert(
      {
        message_id: numericMessageId,
        user_id: currentUserId,
      },
      {
        onConflict: "message_id,user_id",
      }
    );

  if (error) {
    throw new Error(
      `Mesajul nu a putut fi șters pentru tine: ${error.message}`
    );
  }
}

export async function deleteMessageForEveryone(
  messageId: string,
  currentUserId: string
): Promise<MessengerMessage> {
  const numericMessageId = parseMessageId(messageId);

  if (!currentUserId) {
    throw new Error("Utilizatorul nu este autentificat.");
  }

  const { data, error } = await supabase
    .from("messages")
    .update({
      content: "Acest mesaj a fost șters",
      deleted_for_everyone: true,
      edited_at: null,
    })
    .eq("id", numericMessageId)
    .eq("sender_id", currentUserId)
    .select(MESSAGE_SELECT)
    .single();

  if (error) {
    throw new Error(
      `Mesajul nu a putut fi șters pentru toți: ${error.message}`
    );
  }

  const { error: reactionError } = await supabase
    .from("message_reactions")
    .delete()
    .eq("message_id", numericMessageId);

  if (reactionError) {
    console.error(
      `Reacțiile mesajului șters nu au putut fi eliminate: ${reactionError.message}`
    );
  }

  return mapDatabaseMessage(data as DatabaseMessage);
}
