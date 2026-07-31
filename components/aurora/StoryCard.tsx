"use client";

import type { AuroraStory } from "./stories";

type StoryCardProps = {
  story?: AuroraStory;
  isCreateCard?: boolean;
  onClick: () => void;
};

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export default function StoryCard({ story, isCreateCard = false, onClick }: StoryCardProps) {
  if (isCreateCard) {
    return (
      <button type="button" className="aurora-story-card aurora-story-create-card" onClick={onClick} aria-label="Adaugă o poveste">
        <span className="aurora-story-create-visual">
          <span className="aurora-story-create-orbit" aria-hidden="true" />
          <span className="aurora-story-create-plus">+</span>
        </span>
        <span className="aurora-story-card-name">Povestea ta</span>
        <span className="aurora-story-card-note">Adaugă</span>
      </button>
    );
  }

  if (!story) return null;

  return (
    <button type="button" className={`aurora-story-card ${story.seen ? "aurora-story-card-seen" : ""}`} onClick={onClick} aria-label={`Deschide povestea lui ${story.name}`}>
      <span className="aurora-story-card-cover" style={{ backgroundImage: `url("${story.mediaUrl}")` }} aria-hidden="true" />
      <span className="aurora-story-card-shade" aria-hidden="true" />
      <span className="aurora-story-avatar-ring">
        <span className="aurora-story-avatar">
          {story.avatarUrl ? <img src={story.avatarUrl} alt="" /> : initials(story.name)}
        </span>
      </span>
      <span className="aurora-story-card-name">{story.name}</span>
      <span className="aurora-story-card-note">{story.seen ? "Văzut" : "Nou"}</span>
    </button>
  );
}
