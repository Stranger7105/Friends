"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import StoryCard from "./StoryCard";
import StoryUpload from "./StoryUpload";
import StoryViewer from "./StoryViewer";
import type { CreateStoryResult } from "./story-types";
import type { AuroraStory } from "./stories";

type StoryBarProps = {
  currentUserId: string;
};

type StoryDatabaseRow = {
  id: string | number;
  user_id: string;
  media_path: string;
  media_type: "image" | "video";
  caption: string | null;
  audio_path: string | null;
  audio_title: string | null;
  audio_start: number | null;
  audio_volume: number | null;
  effect_type: "none" | "aurora" | "stars" | "snow" | "rain" | "glow" | null;
  effect_intensity: number | null;
  created_at: string;
  expires_at: string;
};

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

const STORY_BUCKET = "story-media";
const AUDIO_BUCKET = "story-audio";

function getPublicStoryUrl(mediaPath: string) {
  return supabase.storage.from(STORY_BUCKET).getPublicUrl(mediaPath).data
    .publicUrl;
}

function getPublicAudioUrl(audioPath: string | null) {
  if (!audioPath) return null;
  return supabase.storage.from(AUDIO_BUCKET).getPublicUrl(audioPath).data.publicUrl;
}

function getDisplayName(profile: ProfileRow | undefined) {
  return profile?.full_name || profile?.username || "Utilizator";
}

export default function StoryBar({ currentUserId }: StoryBarProps) {
  const [stories, setStories] = useState<AuroraStory[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);
  const [loadingStories, setLoadingStories] = useState(true);
  const [storyError, setStoryError] = useState("");

  const loadStories = useCallback(async () => {
    setLoadingStories(true);
    setStoryError("");

    const storiesResult = await supabase
      .from("stories")
      .select(
        "id, user_id, media_path, media_type, caption, audio_path, audio_title, audio_start, audio_volume, effect_type, effect_intensity, created_at, expires_at"
      )
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (storiesResult.error) {
      setStoryError(
        `Poveștile nu au putut fi încărcate: ${storiesResult.error.message}`
      );
      setStories([]);
      setLoadingStories(false);
      return;
    }

    const storyRows = (storiesResult.data ?? []) as StoryDatabaseRow[];
    const userIds = [...new Set(storyRows.map((story) => story.user_id))];

    const profilesById = new Map<string, ProfileRow>();

    if (userIds.length > 0) {
      const profilesResult = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .in("id", userIds);

      if (profilesResult.error) {
        setStoryError(
          `Profilurile poveștilor nu au putut fi încărcate: ${profilesResult.error.message}`
        );
      } else {
        for (const profile of (profilesResult.data ?? []) as ProfileRow[]) {
          profilesById.set(profile.id, profile);
        }
      }
    }

    const normalizedStories: AuroraStory[] = storyRows.map((row) => {
      const profile = profilesById.get(row.user_id);

      return {
        id: String(row.id),
        userId: row.user_id,
        name: getDisplayName(profile),
        username: profile?.username || "friends",
        avatarUrl: profile?.avatar_url || null,
        mediaUrl: getPublicStoryUrl(row.media_path),
        mediaType: row.media_type,
        caption: row.caption,
        audioUrl: getPublicAudioUrl(row.audio_path),
        audioTitle: row.audio_title,
        audioStart: row.audio_start ?? 0,
        audioVolume: row.audio_volume ?? 0.7,
        effectType: row.effect_type ?? "none",
        effectIntensity: row.effect_intensity ?? 0.65,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        seen: false,
      };
    });

    setStories(normalizedStories);
    setLoadingStories(false);
  }, []);

  useEffect(() => {
    void loadStories();
  }, [loadStories]);

  useEffect(() => {
    const channel = supabase
      .channel("aurora-stories-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stories",
        },
        () => {
          void loadStories();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadStories]);

  function handlePublished(_result: CreateStoryResult) {
    setStudioOpen(false);
    void loadStories();
  }

  return (
    <>
      <section
        className="aurora-stories-section"
        aria-labelledby="aurora-stories-title"
      >
        <div className="aurora-stories-heading-row">
          <div>
            <span className="aurora-stories-kicker">MOMENTE DE ACUM</span>
            <h2 id="aurora-stories-title">Aurora Stories</h2>
          </div>

          <span className="aurora-stories-hint">
            {loadingStories ? "Se încarcă..." : "Se deschid fullscreen"}
          </span>
        </div>

        <div className="aurora-stories-scroller">
          <StoryCard
            isCreateCard
            onClick={() => setStudioOpen(true)}
          />

          {stories.map((story, index) => (
            <StoryCard
              key={story.id}
              story={story}
              onClick={() => setViewerIndex(index)}
            />
          ))}
        </div>

        {storyError && (
          <p
            role="alert"
            className="mt-3 rounded-2xl border border-rose-300/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
          >
            {storyError}
          </p>
        )}

        {!loadingStories && !storyError && stories.length === 0 && (
          <p className="mt-3 text-sm text-white/45">
            Nu există încă povești active. Poți publica prima poveste.
          </p>
        )}
      </section>

      <StoryUpload
        open={studioOpen}
        currentUserId={currentUserId}
        onClose={() => setStudioOpen(false)}
        onPublished={handlePublished}
      />

      {viewerIndex !== null && stories[viewerIndex] && (
        <StoryViewer
          stories={stories}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </>
  );
}
