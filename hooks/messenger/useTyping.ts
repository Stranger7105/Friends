"use client";

import { useCallback, useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useMessengerContext } from "@/contexts/MessengerContext";

type UseTypingOptions = {
  conversationId: string | null;
  currentUserId: string;
  timeoutMs?: number;
};

type TypingPayload = {
  conversationId: string;
  userId: string;
  typing: boolean;
};

export function useTyping({
  conversationId,
  currentUserId,
  timeoutMs = 1800,
}: UseTypingOptions) {
  const { setTyping } = useMessengerContext();

  const channelRef = useRef<RealtimeChannel | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentTypingRef = useRef(false);

  const sendTypingState = useCallback(
    async (typing: boolean) => {
      if (!conversationId || !currentUserId) return;

      const channel = channelRef.current;
      if (!channel) return;

      await channel.send({
        type: "broadcast",
        event: "typing",
        payload: {
          conversationId,
          userId: currentUserId,
          typing,
        } satisfies TypingPayload,
      });
    },
    [conversationId, currentUserId]
  );

  const stopTyping = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (!sentTypingRef.current) return;

    sentTypingRef.current = false;
    void sendTypingState(false);
  }, [sendTypingState]);

  const markTyping = useCallback(() => {
    if (!conversationId || !currentUserId) return;

    if (!sentTypingRef.current) {
      sentTypingRef.current = true;
      void sendTypingState(true);
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      sentTypingRef.current = false;
      timeoutRef.current = null;
      void sendTypingState(false);
    }, timeoutMs);
  }, [
    conversationId,
    currentUserId,
    sendTypingState,
    timeoutMs,
  ]);

  useEffect(() => {
    if (!conversationId || !currentUserId) return;

    setTyping(conversationId, false);

    const channel = supabase.channel(
      `messenger-typing-${conversationId}`,
      {
        config: {
          broadcast: {
            self: false,
          },
        },
      }
    );

    channel
      .on(
        "broadcast",
        {
          event: "typing",
        },
        ({ payload }) => {
          const event = payload as TypingPayload;

          if (
            event.conversationId !== conversationId ||
            event.userId === currentUserId
          ) {
            return;
          }

          setTyping(conversationId, event.typing);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      sentTypingRef.current = false;
      setTyping(conversationId, false);
      channelRef.current = null;

      void supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId, setTyping]);

  return {
    markTyping,
    stopTyping,
  };
}