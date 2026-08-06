"use client";

import Link from "next/link";
import useConversations from "../hooks/useConversations";

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("ro-RO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function ConversationList() {
  const { conversations, loading, error } = useConversations();

  if (loading) {
    return <main style={{ padding: 16 }}>Se încarcă conversațiile...</main>;
  }

  if (error) {
    return <main style={{ padding: 16 }}>{error}</main>;
  }

  if (conversations.length === 0) {
    return <main style={{ padding: 16 }}>Nu există conversații.</main>;
  }

  return (
    <main
      style={{
        minHeight: "calc(100dvh - 128px)",
        padding: 16,
        background: "#10131a",
        color: "#ffffff",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          maxWidth: 760,
          margin: "0 auto",
        }}
      >
        {conversations.map((conversation) => (
          <Link
            key={conversation.id}
            href={`/messages/${conversation.id}`}
            style={{
              display: "grid",
              gridTemplateColumns: "52px minmax(0, 1fr) auto",
              alignItems: "center",
              gap: 12,
              padding: 14,
              borderRadius: 16,
              background: "rgba(255,255,255,0.1)",
              color: "inherit",
              textDecoration: "none",
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                display: "grid",
                placeItems: "center",
                overflow: "hidden",
                borderRadius: "50%",
                background: "#10b981",
                fontWeight: 700,
              }}
            >
              {conversation.avatarUrl ? (
                <img
                  src={conversation.avatarUrl}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                initials(conversation.title) || "F"
              )}
            </div>

            <div style={{ minWidth: 0 }}>
              <strong
                style={{
                  display: "block",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {conversation.title}
              </strong>
              <span
                style={{
                  display: "block",
                  marginTop: 4,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontSize: 13,
                  opacity: 0.75,
                }}
              >
                {conversation.lastMessage?.text || "Conversație nouă"}
              </span>
            </div>

            <div style={{ textAlign: "right", fontSize: 12 }}>
              <div style={{ opacity: 0.7 }}>
                {formatTime(
                  conversation.lastMessage?.createdAt ||
                    conversation.updatedAt
                )}
              </div>
              {conversation.unreadCount > 0 && (
                <div
                  style={{
                    display: "inline-grid",
                    placeItems: "center",
                    minWidth: 22,
                    height: 22,
                    marginTop: 6,
                    padding: "0 6px",
                    borderRadius: 11,
                    background: "#10b981",
                    color: "#ffffff",
                    fontWeight: 700,
                  }}
                >
                  {conversation.unreadCount}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
