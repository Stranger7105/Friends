"use client";

import { Globe2, Lock, UsersRound } from "lucide-react";

type AudienceType = "friends" | "group" | "private";

type AudienceBadgeProps = {
  audienceType: AudienceType;
  groupName?: string | null;
  compact?: boolean;
};

export default function AudienceBadge({
  audienceType,
  groupName,
  compact = false,
}: AudienceBadgeProps) {
  const config =
    audienceType === "private"
      ? {
          icon: Lock,
          label: "Doar eu",
          className: "is-private",
          title: "Postare vizibilă doar autorului",
        }
      : audienceType === "group"
        ? {
            icon: UsersRound,
            label: groupName || "Grup",
            className: "is-group",
            title: groupName
              ? `Postare vizibilă grupului ${groupName}`
              : "Postare vizibilă unui grup",
          }
        : {
            icon: Globe2,
            label: "Toți prietenii",
            className: "is-friends",
            title: "Postare vizibilă tuturor prietenilor",
          };

  const Icon = config.icon;

  return (
    <span
      className={`friends-audience-badge ${config.className} ${
        compact ? "is-compact" : ""
      }`}
      title={config.title}
      aria-label={config.title}
    >
      <Icon size={compact ? 12 : 14} />
      <span>{config.label}</span>
    </span>
  );
}
