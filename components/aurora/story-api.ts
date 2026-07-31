import { supabase } from "@/lib/supabase";
import type {
  CreateStoryInput,
  CreateStoryResult,
  StoryMediaType,
  StoryRow,
} from "./story-types";

const STORY_BUCKET = "story-media";
const AUDIO_BUCKET = "story-audio";
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_AUDIO_SIZE = 25 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

const ALLOWED_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/mp4",
  "audio/aac",
  "audio/x-m4a",
]);

function cleanFileName(name: string) {
  const extension = name.includes(".")
    ? `.${name.split(".").pop()?.toLowerCase()}`
    : "";

  const baseName = name
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);

  return `${baseName || "story"}${extension}`;
}

export function getStoryMediaType(file: File): StoryMediaType {
  if (ALLOWED_IMAGE_TYPES.has(file.type)) return "image";
  if (ALLOWED_VIDEO_TYPES.has(file.type)) return "video";

  throw new Error(
    "Format neacceptat. Folosește JPG, PNG, WEBP, GIF, MP4, WEBM sau MOV."
  );
}

export function validateStoryFile(file: File) {
  getStoryMediaType(file);
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Fișierul trebuie să fie mai mic de 50 MB.");
  }
}

function validateAudioFile(file: File) {
  if (!ALLOWED_AUDIO_TYPES.has(file.type)) {
    throw new Error("Melodia trebuie să fie MP3, WAV, OGG, AAC sau M4A.");
  }
  if (file.size > MAX_AUDIO_SIZE) {
    throw new Error("Melodia trebuie să fie mai mică de 25 MB.");
  }
}

export async function createStory({
  userId,
  file,
  caption,
  audioFile = null,
  audioTitle = "",
  audioStart = 0,
  audioVolume = 0.7,
  effectType = "none",
  effectIntensity = 0.65,
}: CreateStoryInput): Promise<CreateStoryResult> {
  if (!userId) throw new Error("Utilizatorul nu este autentificat.");

  validateStoryFile(file);
  if (audioFile) validateAudioFile(audioFile);

  const mediaType = getStoryMediaType(file);
  const mediaPath = `${userId}/${Date.now()}-${crypto.randomUUID()}-${cleanFileName(file.name)}`;

  const mediaUpload = await supabase.storage
    .from(STORY_BUCKET)
    .upload(mediaPath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (mediaUpload.error) {
    throw new Error(`Upload nereușit: ${mediaUpload.error.message}`);
  }

  let audioPath: string | null = null;

  if (audioFile) {
    audioPath = `${userId}/${Date.now()}-${crypto.randomUUID()}-${cleanFileName(audioFile.name)}`;

    const audioUpload = await supabase.storage
      .from(AUDIO_BUCKET)
      .upload(audioPath, audioFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: audioFile.type,
      });

    if (audioUpload.error) {
      await supabase.storage.from(STORY_BUCKET).remove([mediaPath]);
      throw new Error(`Melodia nu s-a încărcat: ${audioUpload.error.message}`);
    }
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const insertResult = await supabase
    .from("stories")
    .insert({
      user_id: userId,
      media_path: mediaPath,
      media_type: mediaType,
      caption: caption.trim() || null,
      audio_path: audioPath,
      audio_title: audioPath ? audioTitle.trim() || audioFile?.name || "Melodie" : null,
      audio_start: Math.max(0, Number(audioStart) || 0),
      audio_volume: Math.max(0, Math.min(1, Number(audioVolume) || 0)),
      effect_type: effectType,
      effect_intensity: Math.max(0.2, Math.min(1, Number(effectIntensity) || 0.65)),
      expires_at: expiresAt,
    })
    .select(
      "id, user_id, media_path, media_type, caption, audio_path, audio_title, audio_start, audio_volume, effect_type, effect_intensity, created_at, expires_at"
    )
    .single();

  if (insertResult.error) {
    await supabase.storage.from(STORY_BUCKET).remove([mediaPath]);
    if (audioPath) await supabase.storage.from(AUDIO_BUCKET).remove([audioPath]);
    throw new Error(
      `Fișierele s-au încărcat, dar povestea nu s-a salvat: ${insertResult.error.message}`
    );
  }

  const publicUrl = supabase.storage.from(STORY_BUCKET).getPublicUrl(mediaPath).data.publicUrl;
  const audioPublicUrl = audioPath
    ? supabase.storage.from(AUDIO_BUCKET).getPublicUrl(audioPath).data.publicUrl
    : null;

  return {
    story: insertResult.data as StoryRow,
    publicUrl,
    audioPublicUrl,
  };
}
