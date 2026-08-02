"use client";

import { motion } from "framer-motion";
import type { AuroraStory } from "./stories";
import HoverVideo from "@/components/media/HoverVideo";
import VisibilityVideo from "@/components/media/VisibilityVideo";

type StoryCardProps = {
  story?: AuroraStory;
  isCreateCard?: boolean;
  onClick: () => void;
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function StoryCard({
  story,
  isCreateCard = false,
  onClick,
}: StoryCardProps) {
  if (isCreateCard) {
    return (
      <motion.button
        type="button"
        className="aurora-story-card aurora-story-create-card"
        onClick={onClick}
        aria-label="Adaugă o poveste"
        whileTap={{ scale: 0.98 }}
      >
        <span className="aurora-story-create-visual">
          <span className="aurora-story-create-orbit" aria-hidden="true" />
          <span className="aurora-story-create-plus">+</span>
        </span>
        <span className="aurora-story-card-name">Povestea ta</span>
        <span className="aurora-story-card-note">Adaugă</span>
      </motion.button>
    );
  }

  if (!story) return null;

  return (
    <motion.button
      type="button"
      className={`aurora-story-card ${
        story.seen ? "aurora-story-card-seen" : ""
      }`}
      onClick={onClick}
      aria-label={`Deschide povestea lui ${story.name}`}
      whileTap={{ scale: 0.98 }}
    >
      <span
        className="aurora-story-card-cover"
        style={{
          backgroundImage:
            story.mediaType === "image"
              ? `url("${story.mediaUrl}")`
              : undefined,
        }}
        aria-hidden="true"
      />

      <HoverVideo
        src={story.mediaUrl}
        mediaType={story.mediaType}
        className="aurora-story-card-preview-video"
        previewMs={story.mediaType === "video" ? 1900 : 2600}
      />

      {story.mediaType === "video" && (
        <VisibilityVideo
          src={story.mediaUrl}
          className="aurora-story-card-preview-video"
          previewMs={1700}
        />
      )}

      <span className="aurora-story-card-shade" aria-hidden="true" />

      <span className="aurora-story-avatar-ring">
        <span className="aurora-story-avatar">
          {story.avatarUrl ? (
            <img src={story.avatarUrl} alt="" />
          ) : (
            initials(story.name)
          )}
        </span>
      </span>

      <span className="aurora-story-card-name">{story.name}</span>
      <span className="aurora-story-card-note">
        {story.seen ? "Văzut" : "Nou"}
      </span>
    </motion.button>
  );
}
