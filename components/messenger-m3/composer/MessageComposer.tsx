"use client";

import useComposer from "../hooks/useComposer";

type MessageComposerProps = {
  onSend: (text: string) => void | Promise<void>;
  sending?: boolean;
};

export default function MessageComposer({
  onSend,
  sending = false,
}: MessageComposerProps) {
  const { text, setText, clear } = useComposer();

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const content = text.trim();

    if (!content || sending) return;

    await onSend(content);
    clear();
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 16,
        borderTop: "1px solid #2a2a2a",
      }}
    >
      <input
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Scrie un mesaj..."
        disabled={sending}
        style={{
          flex: 1,
          minWidth: 0,
          height: 48,
          borderRadius: 24,
          border: "none",
          padding: "0 16px",
        }}
      />

      <button
        type="submit"
        disabled={sending || !text.trim()}
      >
        {sending ? "Se trimite..." : "Trimite"}
      </button>
    </form>
  );
}