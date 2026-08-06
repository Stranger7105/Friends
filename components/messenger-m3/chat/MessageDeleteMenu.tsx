"use client";

type MessageDeleteMenuProps = {
  canDeleteForEveryone: boolean;
  deleting: boolean;
  onDeleteForMe: () => Promise<void>;
  onDeleteForEveryone: () => Promise<void>;
  onClose: () => void;
};

export default function MessageDeleteMenu({
  canDeleteForEveryone,
  deleting,
  onDeleteForMe,
  onDeleteForEveryone,
  onClose,
}: MessageDeleteMenuProps) {
  return (
    <div
      role="dialog"
      aria-label="Ștergere mesaj"
      style={{
        minWidth: 220,
        padding: 10,
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 14,
        background: "rgba(17,24,39,0.98)",
        color: "#ffffff",
        boxShadow: "0 16px 40px rgba(0,0,0,0.38)",
      }}
    >
      <strong
        style={{
          display: "block",
          marginBottom: 8,
          fontSize: 13,
        }}
      >
        Șterge mesajul
      </strong>

      <button
        type="button"
        disabled={deleting}
        onClick={async () => {
          await onDeleteForMe();
          onClose();
        }}
        style={{
          width: "100%",
          minHeight: 40,
          padding: "0 12px",
          border: 0,
          borderRadius: 10,
          background: "rgba(255,255,255,0.08)",
          color: "#ffffff",
          textAlign: "left",
          cursor: "pointer",
          opacity: deleting ? 0.55 : 1,
        }}
      >
        Șterge pentru mine
      </button>

      {canDeleteForEveryone && (
        <button
          type="button"
          disabled={deleting}
          onClick={async () => {
            await onDeleteForEveryone();
            onClose();
          }}
          style={{
            width: "100%",
            minHeight: 40,
            marginTop: 7,
            padding: "0 12px",
            border: 0,
            borderRadius: 10,
            background: "rgba(220,38,38,0.18)",
            color: "#fecaca",
            textAlign: "left",
            cursor: "pointer",
            opacity: deleting ? 0.55 : 1,
          }}
        >
          Șterge pentru toți
        </button>
      )}

      <button
        type="button"
        disabled={deleting}
        onClick={onClose}
        style={{
          width: "100%",
          minHeight: 36,
          marginTop: 7,
          padding: "0 12px",
          border: 0,
          borderRadius: 10,
          background: "transparent",
          color: "#cbd5e1",
          cursor: "pointer",
        }}
      >
        Anulează
      </button>
    </div>
  );
}
