export type StoryMediaType = "image" | "video";

export type StoryRow = {
  id: number;
  user_id: string;
  media_path: string;
  media_type: StoryMediaType;
  caption: string | null;
  audio_path: string | null;
  audio_title: string | null;
  audio_start: number;
  audio_volume: number;
  effect_type: "none" | "aurora" | "stars" | "snow" | "rain" | "glow";
  effect_intensity: number;
  created_at: string;
  expires_at: string;
};

export type CreateStoryInput = {
  userId: string;
  file: File;
  caption: string;
  audioFile?: File | null;
  audioTitle?: string;
  audioStart?: number;
  audioVolume?: number;
  effectType?: "none" | "aurora" | "stars" | "snow" | "rain" | "glow";
  effectIntensity?: number;
};

export type CreateStoryResult = {
  story: StoryRow;
  publicUrl: string;
  audioPublicUrl: string | null;
};
