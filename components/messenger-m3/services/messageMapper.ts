import type { MessengerMessage } from "../types";

export type DatabaseMessage = {
  id: number;
  conversation_id: number;
  sender_id: string;
  content: string | null;
  created_at: string;
  edited_at: string | null;
  seen_at: string | null;
  reply_to_message_id: number | null;
  deleted_for_everyone: boolean | null;
  audio_path: string | null;
  audio_duration: number | null;
};

export const MESSAGE_SELECT =
  "id, conversation_id, sender_id, content, created_at, edited_at, seen_at, reply_to_message_id, deleted_for_everyone, audio_path, audio_duration";

export function mapDatabaseMessage(row: DatabaseMessage): MessengerMessage {
  const deletedForEveryone = row.deleted_for_everyone === true;
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    senderId: row.sender_id,
    text: deletedForEveryone ? "Acest mesaj a fost șters" : row.content ?? "",
    status: row.seen_at ? "seen" : "sent",
    createdAt: row.created_at,
    editedAt: !deletedForEveryone && row.edited_at ? row.edited_at : undefined,
    deletedForEveryone,
    audioPath: !deletedForEveryone && row.audio_path ? row.audio_path : undefined,
    audioDuration: !deletedForEveryone && typeof row.audio_duration === "number" ? row.audio_duration : undefined,
    replyToId: row.reply_to_message_id !== null ? String(row.reply_to_message_id) : undefined,
    attachments: [],
    reactions: [],
  };
}
