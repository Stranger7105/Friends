import { supabase } from "@/lib/supabase";
import type {
  MessengerMessage,
  VoiceRecording,
} from "../types";
import {
  MESSAGE_SELECT,
  mapDatabaseMessage,
  type DatabaseMessage,
} from "./messageMapper";

const VOICE_BUCKET = "chat-audio";
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

const signedUrlCache = new Map<
  string,
  {
    url: string;
    expiresAt: number;
  }
>();

function parsePositiveId(
  value: string,
  errorMessage: string
): number {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(errorMessage);
  }

  return id;
}

function extensionForMimeType(
  mimeType: string
): string {
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("wav")) return "wav";

  return "webm";
}

export async function sendVoiceMessage(
  conversationId: string,
  senderId: string,
  recording: VoiceRecording,
  replyToId?: string
): Promise<MessengerMessage> {
  const conversation = parsePositiveId(
    conversationId,
    "Identificatorul conversației nu este valid."
  );

  const reply = replyToId
    ? parsePositiveId(
        replyToId,
        "Mesajul la care răspunzi nu este valid."
      )
    : null;

  if (!senderId) {
    throw new Error(
      "Utilizatorul nu este autentificat."
    );
  }

  if (!recording.blob.size) {
    throw new Error(
      "Înregistrarea audio este goală."
    );
  }

  if (recording.blob.size > MAX_AUDIO_BYTES) {
    throw new Error(
      "Mesajul vocal depășește limita de 15 MB."
    );
  }

  const duration = Math.max(
    1,
    Math.round(recording.durationSeconds)
  );

  const mimeType =
    recording.mimeType ||
    recording.blob.type ||
    "audio/webm";

  const path =
    `${senderId}/${conversation}/` +
    `${crypto.randomUUID()}.` +
    extensionForMimeType(mimeType);

  const { error: uploadError } =
    await supabase.storage
      .from(VOICE_BUCKET)
      .upload(path, recording.blob, {
        contentType: mimeType,
        cacheControl: "3600",
        upsert: false,
      });

  if (uploadError) {
    throw new Error(
      `Înregistrarea nu a putut fi încărcată: ${uploadError.message}`
    );
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversation,
      sender_id: senderId,
      content: "Mesaj vocal",
      audio_path: path,
      audio_duration: duration,
      reply_to_message_id: reply,
    })
    .select(MESSAGE_SELECT)
    .single();

  if (error) {
    await supabase.storage
      .from(VOICE_BUCKET)
      .remove([path]);

    throw new Error(
      `Mesajul vocal nu a putut fi salvat: ${error.message}`
    );
  }

  return mapDatabaseMessage(
    data as DatabaseMessage
  );
}

export async function createVoiceSignedUrl(
  audioPath: string,
  forceRefresh = false
): Promise<string> {
  if (!audioPath || audioPath === "temporary") {
    throw new Error(
      "Mesajul vocal nu este încă disponibil."
    );
  }

  const now = Date.now();
  const cached = signedUrlCache.get(audioPath);

  if (
    !forceRefresh &&
    cached &&
    cached.expiresAt > now + 60_000
  ) {
    return cached.url;
  }

  const expiresInSeconds = 60 * 60;

  const { data, error } = await supabase.storage
    .from(VOICE_BUCKET)
    .createSignedUrl(
      audioPath,
      expiresInSeconds
    );

  if (error) {
    throw new Error(
      `Mesajul vocal nu a putut fi deschis: ${error.message}`
    );
  }

  signedUrlCache.set(audioPath, {
    url: data.signedUrl,
    expiresAt:
      now + expiresInSeconds * 1000,
  });

  return data.signedUrl;
}
