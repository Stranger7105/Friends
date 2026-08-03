import type { MessengerMessage } from "../types";

type MessageListProps = {
  messages: MessengerMessage[];
  currentUserId: string;
};

export default function MessageList({
  messages,
  currentUserId,
}: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div
        style={{
          height: "100%",
          display: "grid",
          placeItems: "center",
          color: "#8b95a7",
        }}
      >
        Nu există mesaje încă.
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {messages.map((message) => {
        const isMine = message.senderId === currentUserId;

        return (
          <div
            key={message.id}
            style={{
              display: "flex",
              justifyContent: isMine ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "78%",
                padding: "10px 14px",
                borderRadius: 18,
                background: isMine ? "#10b981" : "#ffffff",
                color: isMine ? "#ffffff" : "#111827",
              }}
            >
              <p
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                }}
              >
                {message.text}
              </p>

              <div
                style={{
                  marginTop: 5,
                  fontSize: 11,
                  opacity: 0.7,
                  textAlign: "right",
                }}
              >
                {new Date(message.createdAt).toLocaleTimeString("ro-RO", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}