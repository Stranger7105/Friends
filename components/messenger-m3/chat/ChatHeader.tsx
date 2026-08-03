type ChatHeaderProps = {
  conversationId: string;
};

export default function ChatHeader({
  conversationId,
}: ChatHeaderProps) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        borderBottom: "1px solid #2a2a2a",
      }}
    >
      Friends Messenger M3 — {conversationId}
    </header>
  );
}