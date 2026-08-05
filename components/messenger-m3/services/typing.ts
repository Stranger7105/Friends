import { supabase } from "@/lib/supabase";

type TypingPayload = {
  userId: string;
  isTyping: boolean;
};

type TypingSessionOptions = {
  conversationId: string;
  currentUserId: string;
  onRemoteTyping: (isTyping: boolean) => void;
};

export type TypingSession = {
  send: (isTyping: boolean) => void;
  close: () => void;
};

export function createTypingSession({
  conversationId,
  currentUserId,
  onRemoteTyping,
}: TypingSessionOptions): TypingSession {
  const channel = supabase
    .channel(`messenger-m3-typing-${conversationId}`, {
      config: {
        broadcast: {
          self: false,
        },
      },
    })
    .on(
      "broadcast",
      {
        event: "typing",
      },
      ({ payload }: { payload: TypingPayload }) => {
        if (!payload || payload.userId === currentUserId) {
          return;
        }

        onRemoteTyping(Boolean(payload.isTyping));
      }
    )
    .subscribe();

  return {
    send(isTyping: boolean) {
      void channel.send({
        type: "broadcast",
        event: "typing",
        payload: {
          userId: currentUserId,
          isTyping,
        } satisfies TypingPayload,
      });
    },

    close() {
      void channel.send({
        type: "broadcast",
        event: "typing",
        payload: {
          userId: currentUserId,
          isTyping: false,
        } satisfies TypingPayload,
      });

      void supabase.removeChannel(channel);
    },
  };
}
