"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

type MessageEditorProps = {
  initialText: string;
  saving: boolean;
  onSave: (text: string) => Promise<boolean>;
  onCancel: () => void;
};

export default function MessageEditor({
  initialText,
  saving,
  onSave,
  onCancel,
}: MessageEditorProps) {
  const [text, setText] = useState(initialText);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const content = text.trim();

    if (
      saving ||
      !content ||
      content === initialText.trim()
    ) {
      return;
    }

    const saved = await onSave(content);

    if (saved) {
      onCancel();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minWidth: 220,
      }}
    >
      <textarea
        ref={inputRef}
        value={text}
        onChange={(event) => setText(event.target.value)}
        disabled={saving}
        rows={3}
        style={{
          width: "100%",
          minHeight: 72,
          resize: "vertical",
          border: "1px solid rgba(16,185,129,0.55)",
          borderRadius: 10,
          padding: 10,
          background: "rgba(255,255,255,0.96)",
          color: "#111827",
          font: "inherit",
          outline: "none",
        }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          style={{
            minHeight: 34,
            padding: "0 12px",
            border: "1px solid rgba(148,163,184,0.45)",
            borderRadius: 999,
            background: "transparent",
            color: "inherit",
            cursor: "pointer",
          }}
        >
          Anulează
        </button>

        <button
          type="submit"
          disabled={
            saving ||
            !text.trim() ||
            text.trim() === initialText.trim()
          }
          style={{
            minHeight: 34,
            padding: "0 12px",
            border: 0,
            borderRadius: 999,
            background: "#059669",
            color: "#ffffff",
            fontWeight: 700,
            cursor: "pointer",
            opacity:
              saving ||
              !text.trim() ||
              text.trim() === initialText.trim()
                ? 0.55
                : 1,
          }}
        >
          {saving ? "Se salvează..." : "Salvează"}
        </button>
      </div>
    </form>
  );
}
