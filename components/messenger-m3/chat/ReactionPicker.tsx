"use client";

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "😡"] as const;

type ReactionPickerProps = {
  selectedEmoji?: string;
  onSelect: (emoji: string) => void | Promise<void>;
  onClose: () => void;
};

export default function ReactionPicker({
  selectedEmoji,
  onSelect,
  onClose,
}: ReactionPickerProps) {
  return (
    <div
      role="menu"
      aria-label="Alege o reacție"
      onClick={(event) => event.stopPropagation()}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: 6,
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 999,
        background: "rgba(17,24,39,0.97)",
        boxShadow: "0 12px 34px rgba(0,0,0,0.32)",
        backdropFilter: "blur(14px)",
      }}
    >
      {REACTIONS.map((emoji) => {
        const selected = selectedEmoji === emoji;

        return (
          <button
            key={emoji}
            type="button"
            role="menuitem"
            aria-label={`Reacționează cu ${emoji}`}
            aria-pressed={selected}
            onClick={() => {
              void onSelect(emoji);
              onClose();
            }}
            style={{
              width: 36,
              height: 36,
              display: "grid",
              placeItems: "center",
              padding: 0,
              border: 0,
              borderRadius: "50%",
              background: selected
                ? "rgba(16,185,129,0.26)"
                : "transparent",
              fontSize: 22,
              cursor: "pointer",
              transform: selected ? "scale(1.12)" : "scale(1)",
              transition:
                "transform 140ms ease, background 140ms ease",
            }}
          >
            {emoji}
          </button>
        );
      })}
    </div>
  );
}
