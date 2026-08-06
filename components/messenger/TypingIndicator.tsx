"use client";

import styles from "./MessengerShell.module.css";

type Props = {
  visible: boolean;
  name?: string;
};

export default function TypingIndicator({
  visible,
  name = "Scrie...",
}: Props) {
  if (!visible) return null;

  return (
    <div className={styles.typingIndicator}>
      <div className={styles.typingDots}>
        <span />
        <span />
        <span />
      </div>

      <span className={styles.typingText}>
        {name} tastează...
      </span>
    </div>
  );
}