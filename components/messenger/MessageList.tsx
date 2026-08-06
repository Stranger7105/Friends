"use client";

import { useState } from "react";
import type { MessengerMessage } from "@/types/messenger";

const REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "😡"] as const;

type MessageReaction = (typeof REACTIONS)[number];

type MessageListProps = {
  messages: MessengerMessage[];
  currentUserId: string;
  loading?: boolean;
  error?: string;
  onReply?: (message: MessengerMessage) => void;
  onReact?: (
    message: MessengerMessage,
    reaction: MessageReaction
  ) => void;
};

export default function MessageList({
  messages,
  currentUserId,
  loading = false,
  error = "",
  onReply,
  onReact,
}: MessageListProps) {
  const [reactionPickerMessageId, setReactionPickerMessageId] =
    useState<string | null>(null);

  if (loading) {
    return (
      <div className="friends-m2-message-state" role="status">
        Se încarcă mesajele...
      </div>
    );
  }

  if (error) {
    return (
      <div className="friends-m2-message-state" role="alert">
        {error}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="friends-m2-message-state">
        Nu există mesaje încă. Scrie primul mesaj.
      </div>
    );
  }

  return (
    <div className="friends-m2-message-list">
      {messages.map((message) => {
        const isMine = message.senderId === currentUserId;

        const repliedMessage = message.replyToId
          ? messages.find((item) => item.id === message.replyToId)
          : null;

        const statusLabel =
          message.status === "read"
            ? "✓✓"
            : message.status === "sent"
              ? "✓"
              : message.status === "sending"
                ? "…"
                : "";

        const pickerIsOpen =
          reactionPickerMessageId === message.id;

        const canInteract =
          !message.id.startsWith("temporary-");

        return (
          <article
            key={message.id}
            className={`friends-m2-message-row ${
              isMine ? "is-mine" : "is-theirs"
            }`}
          >
            <div className="friends-m2-message-stack">
              <div className="friends-m2-message-bubble">
                {repliedMessage && (
                  <div className="friends-m2-reply-quote">
                    <strong>↩ Răspuns la</strong>
                    <div>{repliedMessage.text}</div>
                  </div>
                )}

                <p>{message.text}</p>
                {message.reaction && (
  <div className="friends-m2-message-reaction">
    {message.reaction}
  </div>
)}

                <span className="friends-m2-message-meta">
                  {new Date(message.createdAt).toLocaleTimeString(
                    "ro-RO",
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  )}

                  {isMine && statusLabel && (
                    <>
                      {" "}
                      {statusLabel}
                    </>
                  )}
                </span>
              </div>

              {canInteract && (
                <div className="friends-m2-message-actions">
                  {onReply && (
                    <button
                      type="button"
                      className="friends-m2-message-reply-button"
                      onClick={() => onReply(message)}
                      aria-label="Răspunde la mesaj"
                    >
                      ↩ Răspunde
                    </button>
                  )}

                  {onReact && (
                    <button
                      type="button"
                      className="friends-m2-message-reaction-button"
                      onClick={() =>
                        setReactionPickerMessageId((current) =>
                          current === message.id
                            ? null
                            : message.id
                        )
                      }
                      aria-label="Adaugă o reacție"
                      aria-expanded={pickerIsOpen}
                    >
                      😊 Reacție
                    </button>
                  )}
                </div>
              )}

              {pickerIsOpen && onReact && (
                <div
                  className="friends-m2-reaction-picker"
                  role="group"
                  aria-label="Alege reacția"
                >
                  {REACTIONS.map((reaction) => (
                    <button
                      key={reaction}
                      type="button"
                      className="friends-m2-reaction-option"
                      onClick={() => {
                        onReact(message, reaction);
                        setReactionPickerMessageId(null);
                      }}
                      aria-label={`Reacționează cu ${reaction}`}
                    >
                      {reaction}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}