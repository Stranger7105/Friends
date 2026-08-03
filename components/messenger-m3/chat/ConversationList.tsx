"use client";

import Link from "next/link";
import useConversations from "../hooks/useConversations";

export default function ConversationList() {
  const {
    conversations,
    loading,
    error,
  } = useConversations();

  if (loading) {
    return <div>Se încarcă conversațiile...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  if (conversations.length === 0) {
    return <div>Nu există conversații.</div>;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 16,
      }}
    >
      {conversations.map((conversation) => (
        <Link
          key={conversation.id}
          href={`/messages/${conversation.id}`}
          style={{
            display: "block",
            padding: 14,
            borderRadius: 16,
            background: "rgba(255,255,255,0.12)",
            color: "inherit",
            textDecoration: "none",
          }}
        >
          <strong>{conversation.title}</strong>

          <div
            style={{
              marginTop: 4,
              fontSize: 13,
              opacity: 0.75,
            }}
          >
            Conversația #{conversation.id}
          </div>
        </Link>
      ))}
    </div>
  );
}