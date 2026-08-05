import { supabase } from "@/lib/supabase";

type ReactionRealtimePayload = {
  messageId: string;
  userId: string;
};

type ReactionRealtimeOptions = {
  conversationId: string;
  currentUserId: string;
  onRemoteChange: (messageId: string) => void | Promise<void>;
};

export type ReactionRealtimeSession = {
  announceChange: (messageId: string) => void;
  close: () => void;
};

export function createReactionRealtimeSession({
  conversationId,
  currentUserId,
  onRemoteChange,
}: ReactionRealtimeOptions): ReactionRealtimeSession {
  const channel = supabase
    .channel(`messenger-m3-reactions-${conversationId}`, {
      config: {
        broadcast: {
          self: false,
        },
      },
    })
    .on(
      "broadcast",
      {
        event: "reaction-change",
      },
      ({
        payload,
      }: {
        payload: ReactionRealtimePayload;
      }) => {
        if (
          !payload ||
          payload.userId === currentUserId ||
          !payload.messageId
        ) {
          return;
        }

        void onRemoteChange(payload.messageId);
      }
    )
    .subscribe();

  return {
    announceChange(messageId: string) {
      if (!messageId) return;

      void channel.send({
        type: "broadcast",
        event: "reaction-change",
        payload: {
          messageId,
          userId: currentUserId,
        } satisfies ReactionRealtimePayload,
      });
    },

    close() {
      void supabase.removeChannel(channel);
    },
  };
}
