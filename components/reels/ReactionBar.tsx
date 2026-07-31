"use client";

import { AnimatePresence, motion } from "framer-motion";
import { SmilePlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import styles from "./ReactionBar.module.css";

export type ReelReactionEmoji = "❤️" | "😂" | "😮" | "😢" | "👏" | "🔥";

type ReactionCounts = Partial<Record<ReelReactionEmoji, number>>;

type ReactionBarProps = {
  reelId: string;
  counts: ReactionCounts;
  myReaction: ReelReactionEmoji | null;
  disabled?: boolean;
  onSelect: (emoji: ReelReactionEmoji) => void | Promise<void>;
};

const EMOJIS: ReelReactionEmoji[] = ["❤️", "😂", "😮", "😢", "👏", "🔥"];

export default function ReactionBar({
  counts,
  myReaction,
  disabled = false,
  onSelect,
}: ReactionBarProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  function startHold() {
    if (disabled) return;
    holdTimerRef.current = setTimeout(() => setOpen(true), 420);
  }

  function stopHold() {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }

  async function select(emoji: ReelReactionEmoji) {
    setOpen(false);
    await onSelect(emoji);
  }

  const total = EMOJIS.reduce((sum, emoji) => sum + (counts[emoji] ?? 0), 0);
  const visible = EMOJIS.filter((emoji) => (counts[emoji] ?? 0) > 0).slice(0, 3);

  return (
    <div
      ref={wrapRef}
      className={styles.wrap}
      onMouseEnter={() => !disabled && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={`${styles.trigger} ${myReaction ? styles.active : ""}`}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        onPointerDown={startHold}
        onPointerUp={stopHold}
        onPointerCancel={stopHold}
        aria-label="Reacționează la Reel"
      >
        <span className={styles.icon}>
          {myReaction ?? <SmilePlus />}
        </span>
        <small>{total > 0 ? total : "Reacții"}</small>
      </button>

      {visible.length > 0 && (
        <div className={styles.summary} aria-label="Rezumat reacții">
          {visible.map((emoji) => (
            <span key={emoji} title={`${counts[emoji] ?? 0} reacții`}>
              {emoji}
            </span>
          ))}
        </div>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            className={styles.picker}
            initial={{ opacity: 0, scale: 0.88, x: 10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.88, x: 10 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
          >
            {EMOJIS.map((emoji, index) => (
              <motion.button
                key={emoji}
                initial={{ opacity: 0, scale: 0.45, y: 9 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 480,
                  damping: 24,
                  delay: index * 0.045,
                }}
                type="button"
                className={myReaction === emoji ? styles.selected : ""}
                onClick={() => void select(emoji)}
                whileHover={{ scale: 1.28, y: -5 }}
                whileTap={{ scale: 0.84 }}
                title={myReaction === emoji ? "Elimină reacția" : `Reacționează ${emoji}`}
              >
                {emoji}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
