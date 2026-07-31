import { supabase } from "@/lib/supabase";

export type NotificationType =
  | "reaction"
  | "comment"
  | "share"
  | "friend_request"
  | "friend_accepted"
  | "message"
  | "reel_comment_reply"
  | "reel_comment_like"
  | "reel_comment_reaction"
  | "reel_like"
  | "reel_reaction";

type CreateNotificationInput = {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  text: string;
  reelId?: string | null;
  commentId?: string | null;
  reaction?: string | null;
  dedupeKey?: string | null;
};

/**
 * Creează sau actualizează o notificare fără a notifica utilizatorul
 * pentru propriile acțiuni. Cheia dedupeKey previne duplicatele.
 */
export async function createNotification({
  recipientId,
  actorId,
  type,
  text,
  reelId = null,
  commentId = null,
  reaction = null,
  dedupeKey = null,
}: CreateNotificationInput) {
  if (!recipientId || !actorId || recipientId === actorId) {
    return { error: null };
  }

  const payload = {
    recipient_id: recipientId,
    actor_id: actorId,
    type,
    text,
    reel_id: reelId,
    comment_id: commentId,
    reaction,
    dedupe_key: dedupeKey,
    is_read: false,
    created_at: new Date().toISOString(),
  };

  if (dedupeKey) {
    const result = await supabase.from("notifications").upsert(payload, {
      onConflict: "recipient_id,actor_id,type,dedupe_key",
    });

    return { error: result.error };
  }

  const result = await supabase.from("notifications").insert(payload);
  return { error: result.error };
}
