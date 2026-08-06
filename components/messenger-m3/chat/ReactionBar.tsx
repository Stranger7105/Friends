"use client";

import { useMemo } from "react";
import type { MessageReaction } from "../types";

type ReactionBarProps = {
  reactions: MessageReaction[];
  currentUserId: string;
  onSelect: (emoji: string) => void | Promise<void>;
};

type ReactionGroup = {
  emoji: string;
  count: number;
  selectedByCurrentUser: boolean;
};

export default function ReactionBar({
  reactions,
  currentUserId,
  onSelect,
}: ReactionBarProps) {
  const groups = useMemo<ReactionGroup[]>(() => {
    const grouped = new Map<string, ReactionGroup>();

    for (const reaction of reactions) {
      const current = grouped.get(reaction.emoji);

      if (current) {
        current.count += 1;
        current.selectedByCurrentUser =
          current.selectedByCurrentUser ||
          reaction.userId === currentUserId;
      } else {
        grouped.set(reaction.emoji, {
          emoji: reaction.emoji,
          count: 1,
          selectedByCurrentUser:
            reaction.userId === currentUserId,
        });
      }
    }

    return Array.from(grouped.values());
  }, [currentUserId, reactions]);

  if (groups.length === 0) {
    return null;
  }

  return (
    <div
      aria-label="Reacții"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 5,
        marginTop: 7,
      }}
    >
      {groups.map((group) => (
        <button
          key={group.emoji}
          type="button"
          onClick={() => void onSelect(group.emoji)}
          aria-pressed={group.selectedByCurrentUser}
          title={
            group.selectedByCurrentUser
              ? "Apasă pentru a elimina reacția"
              : "Apasă pentru a reacționa"
          }
          style={{
            minHeight: 27,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            border: group.selectedByCurrentUser
              ? "1px solid rgba(16,185,129,0.75)"
              : "1px solid rgba(148,163,184,0.32)",
            borderRadius: 999,
            background: group.selectedByCurrentUser
              ? "rgba(16,185,129,0.16)"
              : "rgba(15,23,42,0.1)",
            color: "inherit",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          <span aria-hidden="true">{group.emoji}</span>
          <span>{group.count}</span>
        </button>
      ))}
    </div>
  );
}
