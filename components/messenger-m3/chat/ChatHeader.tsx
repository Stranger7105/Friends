import type { MessengerConversation } from "../types";

type ChatHeaderProps = {
  conversation: MessengerConversation;
  isTyping: boolean;
};

function initials(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function ChatHeader({
  conversation,
  isTyping,
}: ChatHeaderProps) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        minWidth: 0,
        padding: "0 16px",
        borderBottom: "1px solid #2a2a2a",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          overflow: "hidden",
          borderRadius: "50%",
          background: "#10b981",
          color: "#ffffff",
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
            fontSize: 12,
            opacity: isTyping ? 1 : 0.7,
            color: isTyping ? "#86efac" : "inherit",
          }}
        >
          {isTyping ? "Scrie..." : "Friends Messenger"}
        </span>
      </div>
    </header>
  );
}
