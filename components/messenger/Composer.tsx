"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import type { MessengerMessage } from "@/types/messenger";
import { useTyping } from "@/hooks/messenger/useTyping";

type ComposerProps = {
  conversationId: string | null;
  currentUserId: string;
  onSend: (text: string) => Promise<void> | void;
  sending?: boolean;

  replyMessage?: MessengerMessage | null;
  onCancelReply?: () => void;
};

export default function Composer({
  conversationId,
  currentUserId,
  onSend,
  sending = false,
  replyMessage = null,
  onCancelReply,
}: ComposerProps) {
  const [value, setValue] = useState("");

  const {
    markTyping,
    stopTyping,
  } = useTyping({
    conversationId,
    currentUserId,
  });

  useEffect(() => {
    return () => {
      stopTyping();
    };
  }, [stopTyping]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const text = value.trim();

    if (!text || sending) return;

    stopTyping();

    await onSend(text);

    setValue("");
  }

  return (
    <form
      className="friends-m2-composer"
      onSubmit={handleSubmit}
    >
      {replyMessage && (
  <div className="friends-m2-reply-preview">
    <strong>Răspunzi la:</strong>

    <div>{replyMessage.text}</div>

    <button
      type="button"
      onClick={onCancelReply}
    >
      ✕
    </button>
  </div>
)}
      <input
        type="text"
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value;

          setValue(nextValue);

          if (nextValue.trim()) {
            markTyping();
          } else {
            stopTyping();
          }
        }}
        onBlur={stopTyping}
        placeholder="Scrie un mesaj..."
        aria-label="Scrie un mesaj"
        disabled={sending}
      />

      <button
        type="submit"
        disabled={!value.trim() || sending}
        aria-label="Trimite mesajul"
      >
        {sending ? "..." : "Trimite"}
      </button>
    </form>
  );
}