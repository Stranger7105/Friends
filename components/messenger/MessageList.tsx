"use client";

import type { MessengerMessage } from "@/types/messenger";

type MessageListProps = {
  messages: MessengerMessage[];
  currentUserId: string;
  loading?: boolean;
  error?: string;
  onReply?: (message: MessengerMessage) => void;
};

export default function MessageList({
  messages,
  currentUserId,
  loading = false,
  error = "",
  onReply,
}: MessageListProps) {
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
        const repliedMessage =
  message.replyToId
    ? messages.find(
        (item) => item.id === message.replyToId
      )
    : null;

        const statusLabel =
          message.status === "read"
            ? "✓✓"
            : message.status === "sent"
              ? "✓"
              : message.status === "sending"
                ? "…"
                : "";

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

    <div>
      {repliedMessage.text}
    </div>
  </div>
)}
                <p>{message.text}</p>

                <span className="friends-m2-message-meta">
                  {new Date(message.createdAt).toLocaleTimeString("ro-RO", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}

                  {isMine && statusLabel && (
                    <>
                      {" "}
                      {statusLabel}
                    </>
                  )}
                </span>
              </div>

              {onReply && !message.id.startsWith("temporary-") && (
                <button
                  type="button"
                  className="friends-m2-message-reply-button"
                  onClick={() => onReply(message)}
                  aria-label="Răspunde la mesaj"
                >
                  ↩ Răspunde
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}