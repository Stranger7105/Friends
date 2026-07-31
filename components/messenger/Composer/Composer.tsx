"use client";

import { useState, type FormEvent } from "react";
import styles from "./Composer.module.css";

type ComposerProps = {
  disabled?: boolean;
  onSend: (text: string) => void | Promise<void>;
};

export default function Composer({
  disabled = false,
  onSend,
}: ComposerProps) {
  const [text, setText] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = text.trim();

    if (!clean || disabled) return;

    setText("");
    await onSend(clean);
  }

  return (
    <form className={styles.composer} onSubmit={submit}>
      <button type="button" disabled title="Atașamentele vin în M1.3">＋</button>

      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Scrie un mesaj..."
        rows={1}
        disabled={disabled}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />

      <button
        type="submit"
        className={styles.send}
        disabled={disabled || !text.trim()}
        aria-label="Trimite mesajul"
      >
        ➤
      </button>
    </form>
  );
}
