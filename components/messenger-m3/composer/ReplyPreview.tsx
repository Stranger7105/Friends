import type { MessengerMessage } from "../types";

type ReplyPreviewProps = {
  message: MessengerMessage;
  onCancel: () => void;
};

export default function ReplyPreview({
  message,
  onCancel,
}: ReplyPreviewProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 10,
        padding: "9px 12px",
        borderLeft: "3px solid #10b981",
        borderRadius: 10,
        background: "rgba(255,255,255,0.08)",
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <strong
          style={{
            display: "block",
            marginBottom: 2,
            fontSize: 12,
            color: "#86efac",
          }}
        >
          Răspunzi la mesaj
        </strong>

        <div
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: 13,
            opacity: 0.85,
          }}
        >
          {message.text}
        </div>
      </div>

      <button
        type="button"
        onClick={onCancel}
        aria-label="Anulează răspunsul"
        style={{
          width: 32,
          height: 32,
          border: 0,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.1)",
          color: "#ffffff",
          cursor: "pointer",
        }}
      >
        ×
      </button>
    </div>
  );
}
