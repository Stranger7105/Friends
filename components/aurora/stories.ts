"use client";

export type AuroraStory = {
  id: string;
  userId: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  mediaUrl: string;
  mediaType: "image" | "video";
  caption: string | null;
  audioUrl: string | null;
  audioTitle: string | null;
  audioStart: number;
  audioVolume: number;
  effectType: "none" | "aurora" | "stars" | "snow" | "rain" | "glow";
  effectIntensity: number;
  createdAt: string;
  expiresAt: string;
  seen: boolean;
};
