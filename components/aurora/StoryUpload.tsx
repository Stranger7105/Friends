"use client";

import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { createStory, validateStoryFile } from "./story-api";
import type { CreateStoryResult } from "./story-types";
import AuroraDrawCanvas, {
  type AuroraDrawCanvasHandle,
  type DrawTool,
} from "./AuroraDrawCanvas";

type StoryUploadProps = {
  open: boolean;
  currentUserId: string;
  onClose: () => void;
  onPublished: (result: CreateStoryResult) => void;
};

type TextBackground = "none" | "dark" | "light" | "aurora";
type TextEffect = "none" | "shadow" | "glow";
type StickerKind = "emoji" | "time" | "date" | "location" | "aurora";
type StoryEffect = "none" | "aurora" | "stars" | "snow" | "rain" | "glow";

type StorySticker = {
  id: string;
  kind: StickerKind;
  label: string;
  x: number;
  y: number;
  size: number;
};

const FONT_OPTIONS = [
  { label: "Modern", value: "Arial, sans-serif" },
  { label: "Elegant", value: "Georgia, serif" },
  { label: "Clasic", value: "'Times New Roman', serif" },
  { label: "Rotund", value: "'Trebuchet MS', sans-serif" },
  { label: "Puternic", value: "Impact, sans-serif" },
  { label: "Curat", value: "Verdana, sans-serif" },
  { label: "Tehnic", value: "'Courier New', monospace" },
  { label: "Prietenos", value: "'Comic Sans MS', cursive" },
  { label: "Compact", value: "'Arial Narrow', Arial, sans-serif" },
  { label: "Book", value: "Garamond, serif" },
  { label: "Palatino", value: "'Palatino Linotype', serif" },
  { label: "Lucida", value: "'Lucida Sans', sans-serif" },
];

const TEXT_COLORS = [
  "#ffffff",
  "#111827",
  "#67e8f9",
  "#a7f3d0",
  "#c4b5fd",
  "#f9a8d4",
  "#fde68a",
  "#fb7185",
];

const EMOJIS = ["😊", "❤️", "✨", "🔥", "🎉", "🌈", "💚", "😂", "👏", "⭐"];

const STICKER_EMOJIS = ["💚", "✨", "🔥", "🎉", "🌈", "⭐", "😂", "👏"];

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Fotografia nu a putut fi procesată."));
    image.src = source;
  });
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

async function renderEditedImage({
  file,
  previewUrl,
  text,
  textX,
  textY,
  fontSize,
  fontFamily,
  textColor,
  textBackground,
  textEffect,
  stickers,
  drawingDataUrl,
}: {
  file: File;
  previewUrl: string;
  text: string;
  textX: number;
  textY: number;
  fontSize: number;
  fontFamily: string;
  textColor: string;
  textBackground: TextBackground;
  textEffect: TextEffect;
  stickers: StorySticker[];
  drawingDataUrl: string | null;
}) {
  if (!text.trim() && stickers.length === 0 && !drawingDataUrl) return file;

  const image = await loadImage(previewUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Editorul foto nu este disponibil în acest browser.");

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  if (drawingDataUrl) {
    const drawingLayer = await loadImage(drawingDataUrl);
    context.drawImage(drawingLayer, 0, 0, canvas.width, canvas.height);
  }

  const scale = Math.max(canvas.width, canvas.height) / 900;
  const renderedFontSize = Math.max(20, fontSize * scale);
  const x = (textX / 100) * canvas.width;
  const y = (textY / 100) * canvas.height;

  context.font = `800 ${renderedFontSize}px ${fontFamily}`;
  context.textAlign = "center";
  context.textBaseline = "middle";

  const lines = text.trim().split("\n").slice(0, 5);
  const lineHeight = renderedFontSize * 1.18;
  const paddingX = renderedFontSize * 0.55;
  const paddingY = renderedFontSize * 0.32;
  const widths = lines.map((line) => context.measureText(line).width);
  const boxWidth = Math.min(
    canvas.width * 0.9,
    Math.max(...widths, renderedFontSize) + paddingX * 2
  );
  const boxHeight = lines.length * lineHeight + paddingY * 2;
  const boxX = Math.max(0, Math.min(canvas.width - boxWidth, x - boxWidth / 2));
  const boxY = Math.max(0, Math.min(canvas.height - boxHeight, y - boxHeight / 2));

  if (textBackground !== "none") {
    roundedRect(context, boxX, boxY, boxWidth, boxHeight, renderedFontSize * 0.35);

    if (textBackground === "dark") {
      context.fillStyle = "rgba(2, 6, 23, 0.76)";
    } else if (textBackground === "light") {
      context.fillStyle = "rgba(255, 255, 255, 0.82)";
    } else {
      const gradient = context.createLinearGradient(boxX, boxY, boxX + boxWidth, boxY);
      gradient.addColorStop(0, "rgba(124, 58, 237, 0.80)");
      gradient.addColorStop(0.5, "rgba(217, 70, 239, 0.78)");
      gradient.addColorStop(1, "rgba(34, 211, 238, 0.78)");
      context.fillStyle = gradient;
    }

    context.fill();
  }

  context.fillStyle = textColor;

  if (textEffect === "shadow") {
    context.shadowColor = "rgba(0, 0, 0, 0.85)";
    context.shadowBlur = renderedFontSize * 0.14;
    context.shadowOffsetY = renderedFontSize * 0.09;
  } else if (textEffect === "glow") {
    context.shadowColor = textColor;
    context.shadowBlur = renderedFontSize * 0.42;
  }

  const firstLineY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    context.fillText(line, x, firstLineY + index * lineHeight, canvas.width * 0.86);
  });

  context.shadowColor = "transparent";
  context.shadowBlur = 0;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;

  for (const sticker of stickers) {
    const stickerX = (sticker.x / 100) * canvas.width;
    const stickerY = (sticker.y / 100) * canvas.height;
    const stickerSize = Math.max(24, sticker.size * scale);

    context.save();
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font =
      sticker.kind === "emoji"
        ? `${stickerSize}px Arial, sans-serif`
        : `800 ${stickerSize * 0.62}px Arial, sans-serif`;

    const metrics = context.measureText(sticker.label);
    const stickerWidth = metrics.width + stickerSize * 0.7;
    const stickerHeight = stickerSize * 1.05;

    if (sticker.kind !== "emoji") {
      roundedRect(
        context,
        stickerX - stickerWidth / 2,
        stickerY - stickerHeight / 2,
        stickerWidth,
        stickerHeight,
        stickerSize * 0.28
      );

      if (sticker.kind === "aurora") {
        const stickerGradient = context.createLinearGradient(
          stickerX - stickerWidth / 2,
          stickerY,
          stickerX + stickerWidth / 2,
          stickerY
        );
        stickerGradient.addColorStop(0, "rgba(124, 58, 237, 0.88)");
        stickerGradient.addColorStop(0.5, "rgba(217, 70, 239, 0.86)");
        stickerGradient.addColorStop(1, "rgba(34, 211, 238, 0.88)");
        context.fillStyle = stickerGradient;
      } else {
        context.fillStyle = "rgba(2, 6, 23, 0.78)";
      }

      context.fill();
      context.fillStyle = "#ffffff";
      context.shadowColor = "rgba(0,0,0,.65)";
      context.shadowBlur = stickerSize * 0.08;
    }

    context.fillText(sticker.label, stickerX, stickerY);
    context.restore();
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("Imaginea editată nu a putut fi creată."))),
      "image/jpeg",
      0.92
    );
  });

  const originalBaseName = file.name.replace(/\.[^/.]+$/, "") || "story";
  return new File([blob], `${originalBaseName}-aurora.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

export default function StoryUpload({
  open,
  currentUserId,
  onClose,
  onPublished,
}: StoryUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const stickerDragOffsetRef = useRef({ x: 0, y: 0 });
  const drawCanvasRef = useRef<AuroraDrawCanvasHandle | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [overlayText, setOverlayText] = useState("");
  const [textX, setTextX] = useState(50);
  const [textY, setTextY] = useState(50);
  const [fontSize, setFontSize] = useState(42);
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].value);
  const [textColor, setTextColor] = useState("#ffffff");
  const [textBackground, setTextBackground] = useState<TextBackground>("none");
  const [textEffect, setTextEffect] = useState<TextEffect>("shadow");
  const [draggingText, setDraggingText] = useState(false);
  const [draggingStickerId, setDraggingStickerId] = useState<string | null>(null);
  const [stickers, setStickers] = useState<StorySticker[]>([]);
  const [locationText, setLocationText] = useState("");
  const [drawingEnabled, setDrawingEnabled] = useState(false);
  const [drawTool, setDrawTool] = useState<DrawTool>("pencil");
  const [drawColor, setDrawColor] = useState("#67e8f9");
  const [drawSize, setDrawSize] = useState(8);
  const [drawingDataUrl, setDrawingDataUrl] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [audioTitle, setAudioTitle] = useState("");
  const [audioStart, setAudioStart] = useState(0);
  const [audioVolume, setAudioVolume] = useState(0.7);
  const [audioDuration, setAudioDuration] = useState(0);
  const [storyEffect, setStoryEffect] = useState<StoryEffect>("none");
  const [effectIntensity, setEffectIntensity] = useState(0.65);
  const [draggingFile, setDraggingFile] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("aurora-overlay-change", { detail: { open } })
    );

    document.body.style.overflow = open ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
      window.dispatchEvent(
        new CustomEvent("aurora-overlay-change", { detail: { open: false } })
      );
    };
  }, [open]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!audioFile) {
      setAudioPreviewUrl(null);
      setAudioDuration(0);
      return;
    }

    const url = URL.createObjectURL(audioFile);
    setAudioPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioFile]);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setCaption("");
      setOverlayText("");
      setTextX(50);
      setTextY(50);
      setStickers([]);
      setLocationText("");
      setFontSize(42);
      setFontFamily(FONT_OPTIONS[0].value);
      setTextColor("#ffffff");
      setTextBackground("none");
      setTextEffect("shadow");
      setDraggingText(false);
      setDraggingStickerId(null);
      setStickers([]);
      setLocationText("");
      setDrawingEnabled(false);
      setDrawTool("pencil");
      setDrawColor("#67e8f9");
      setDrawSize(8);
      setDrawingDataUrl(null);
      setAudioFile(null);
      setAudioPreviewUrl(null);
      setAudioTitle("");
      setAudioStart(0);
      setAudioVolume(0.7);
      setAudioDuration(0);
      setStoryEffect("none");
      setEffectIntensity(0.65);
      setDraggingFile(false);
      setPublishing(false);
      setErrorMessage("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !publishing) onClose();
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose, publishing]);

  if (!open) return null;

  function chooseFile(nextFile: File | null) {
    setErrorMessage("");

    if (!nextFile) {
      setFile(null);
      return;
    }

    try {
      validateStoryFile(nextFile);
      setFile(nextFile);
      setOverlayText("");
      setTextX(50);
      setTextY(50);
    } catch (error) {
      setFile(null);
      setErrorMessage(
        error instanceof Error ? error.message : "Fișierul nu este valid."
      );
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    chooseFile(event.target.files?.[0] || null);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDraggingFile(false);
    chooseFile(event.dataTransfer.files?.[0] || null);
  }

  function updateTextPosition(clientX: number, clientY: number) {
    const editor = editorRef.current;
    if (!editor) return;

    const rect = editor.getBoundingClientRect();
    const x = ((clientX - rect.left - dragOffsetRef.current.x) / rect.width) * 100;
    const y = ((clientY - rect.top - dragOffsetRef.current.y) / rect.height) * 100;

    setTextX(Math.max(8, Math.min(92, x)));
    setTextY(Math.max(8, Math.min(92, y)));
  }

  function handleTextPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (publishing || drawingEnabled) return;

    const editor = editorRef.current;
    if (!editor) return;

    const editorRect = editor.getBoundingClientRect();
    const textRect = event.currentTarget.getBoundingClientRect();

    dragOffsetRef.current = {
      x: event.clientX - (textRect.left + textRect.width / 2),
      y: event.clientY - (textRect.top + textRect.height / 2),
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingText(true);

    const centerX = textRect.left + textRect.width / 2;
    const centerY = textRect.top + textRect.height / 2;

    setTextX(((centerX - editorRect.left) / editorRect.width) * 100);
    setTextY(((centerY - editorRect.top) / editorRect.height) * 100);
  }

  function handleTextPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingText) return;
    updateTextPosition(event.clientX, event.clientY);
  }

  function handleTextPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDraggingText(false);
  }

  function addSticker(kind: StickerKind, label: string) {
    if (!file || isVideo || publishing) return;

    setStickers((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        kind,
        label,
        x: 50,
        y: 35 + Math.min(current.length * 9, 45),
        size: kind === "emoji" ? 58 : 48,
      },
    ]);
  }

  function addTimeSticker() {
    const value = new Intl.DateTimeFormat("ro-RO", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());
    addSticker("time", `🕒 ${value}`);
  }

  function addDateSticker() {
    const value = new Intl.DateTimeFormat("ro-RO", {
      day: "2-digit",
      month: "short",
    }).format(new Date());
    addSticker("date", `📅 ${value}`);
  }

  function addLocationSticker() {
    const value = locationText.trim();
    if (!value) {
      setErrorMessage("Scrie mai întâi locația pentru sticker.");
      return;
    }
    setErrorMessage("");
    addSticker("location", `📍 ${value.slice(0, 40)}`);
  }

  function removeSticker(id: string) {
    setStickers((current) => current.filter((sticker) => sticker.id !== id));
  }

  function handleStickerPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
    sticker: StorySticker
  ) {
    if (publishing || drawingEnabled) return;

    const editor = editorRef.current;
    if (!editor) return;

    const rect = editor.getBoundingClientRect();
    const centerX = rect.left + (sticker.x / 100) * rect.width;
    const centerY = rect.top + (sticker.y / 100) * rect.height;

    stickerDragOffsetRef.current = {
      x: event.clientX - centerX,
      y: event.clientY - centerY,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingStickerId(sticker.id);
  }

  function handleStickerPointerMove(
    event: ReactPointerEvent<HTMLDivElement>,
    stickerId: string
  ) {
    if (draggingStickerId !== stickerId) return;

    const editor = editorRef.current;
    if (!editor) return;

    const rect = editor.getBoundingClientRect();
    const x =
      ((event.clientX - rect.left - stickerDragOffsetRef.current.x) / rect.width) *
      100;
    const y =
      ((event.clientY - rect.top - stickerDragOffsetRef.current.y) / rect.height) *
      100;

    setStickers((current) =>
      current.map((sticker) =>
        sticker.id === stickerId
          ? {
              ...sticker,
              x: Math.max(8, Math.min(92, x)),
              y: Math.max(8, Math.min(92, y)),
            }
          : sticker
      )
    );
  }

  function handleStickerPointerUp(
    event: ReactPointerEvent<HTMLDivElement>,
    stickerId: string
  ) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (draggingStickerId === stickerId) setDraggingStickerId(null);
  }

  function chooseAudio(nextFile: File | null) {
    setErrorMessage("");

    if (!nextFile) {
      setAudioFile(null);
      setAudioTitle("");
      setAudioStart(0);
      return;
    }

    const allowed = new Set([
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/x-wav",
      "audio/ogg",
      "audio/mp4",
      "audio/aac",
      "audio/x-m4a",
    ]);

    if (!allowed.has(nextFile.type)) {
      setErrorMessage("Melodia trebuie să fie MP3, WAV, OGG, AAC sau M4A.");
      return;
    }

    if (nextFile.size > 25 * 1024 * 1024) {
      setErrorMessage("Melodia trebuie să fie mai mică de 25 MB.");
      return;
    }

    setAudioFile(nextFile);
    setAudioTitle(nextFile.name.replace(/\.[^/.]+$/, "").slice(0, 80));
    setAudioStart(0);
  }

  function handleAudioInputChange(event: ChangeEvent<HTMLInputElement>) {
    chooseAudio(event.target.files?.[0] || null);
    event.target.value = "";
  }

  function previewAudio() {
    const audio = audioPreviewRef.current;
    if (!audio) return;

    audio.currentTime = Math.min(audioStart, Math.max(0, audio.duration || 0));
    audio.volume = audioVolume;
    void audio.play();
  }

  function pauseAudio() {
    audioPreviewRef.current?.pause();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file || publishing) return;

    setPublishing(true);
    setErrorMessage("");

    try {
      const isVideo = file.type.startsWith("video/");
      const publishFile =
        !isVideo && previewUrl
          ? await renderEditedImage({
              file,
              previewUrl,
              text: overlayText,
              textX,
              textY,
              fontSize,
              fontFamily,
              textColor,
              textBackground,
              textEffect,
              stickers,
              drawingDataUrl,
            })
          : file;

      const result = await createStory({
        userId: currentUserId,
        file: publishFile,
        caption,
        audioFile,
        audioTitle,
        audioStart,
        audioVolume,
        effectType: storyEffect,
        effectIntensity,
      });

      onPublished(result);
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Povestea nu a putut fi publicată."
      );
    } finally {
      setPublishing(false);
    }
  }

  const isVideo = file?.type.startsWith("video/") ?? false;

  const backgroundClass =
    textBackground === "dark"
      ? "bg-slate-950/75 px-4 py-2"
      : textBackground === "light"
        ? "bg-white/85 px-4 py-2"
        : textBackground === "aurora"
          ? "bg-gradient-to-r from-violet-600/85 via-fuchsia-500/80 to-cyan-400/80 px-4 py-2"
          : "";

  const effectStyle =
    textEffect === "shadow"
      ? "0 4px 14px rgba(0,0,0,.9)"
      : textEffect === "glow"
        ? `0 0 18px ${textColor}, 0 0 34px ${textColor}`
        : "none";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-slate-950/85 p-3 backdrop-blur-md sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="story-upload-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !publishing) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="my-auto w-full max-w-6xl overflow-hidden rounded-[30px] border border-white/15 bg-slate-950 text-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-bold tracking-[0.22em] text-cyan-300">
              AURORA STORY EDITOR · PACK 2E
            </p>
            <h2 id="story-upload-title" className="mt-1 text-xl font-black">
              Creează o poveste
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={publishing}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-xl transition hover:scale-105 hover:bg-white/10 disabled:opacity-40"
            aria-label="Închide"
          >
            ×
          </button>
        </header>

        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_330px] sm:p-6">
          <div className="space-y-4">
            {!file ? (
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setDraggingFile(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setDraggingFile(false);
                }}
                onDrop={handleDrop}
                className={`flex min-h-[520px] cursor-pointer flex-col items-center justify-center rounded-[26px] border border-dashed p-6 text-center transition ${
                  draggingFile
                    ? "border-cyan-300 bg-cyan-300/10"
                    : "border-white/25 bg-white/[0.04] hover:border-violet-300/60 hover:bg-white/[0.07]"
                }`}
                onClick={() => inputRef.current?.click()}
              >
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 text-3xl shadow-lg shadow-violet-500/25">
                  +
                </div>
                <p className="text-lg font-bold">
                  Alege o fotografie sau un video
                </p>
                <p className="mt-2 max-w-md text-sm text-white/60">
                  Poți apăsa aici sau trage fișierul în această zonă. Maximum 50 MB.
                </p>
              </div>
            ) : (
              <div
                ref={editorRef}
                className="relative mx-auto flex min-h-[520px] w-full max-w-[520px] touch-none items-center justify-center overflow-hidden rounded-[28px] border border-white/15 bg-black"
              >
                {isVideo ? (
                  <video
                    src={previewUrl || undefined}
                    controls
                    playsInline
                    className="max-h-[70vh] w-full object-contain"
                  />
                ) : (
                  <img
                    src={previewUrl || undefined}
                    alt="Previzualizare poveste"
                    className="max-h-[70vh] w-full select-none object-contain"
                    draggable={false}
                  />
                )}

                {!isVideo && (
                  <AuroraDrawCanvas
                    key={previewUrl || "aurora-draw"}
                    ref={drawCanvasRef}
                    active={drawingEnabled}
                    tool={drawTool}
                    color={drawColor}
                    size={drawSize}
                    onChange={setDrawingDataUrl}
                  />
                )}

                {!isVideo && storyEffect !== "none" && (
                  <div
                    className={`pointer-events-none absolute inset-0 z-20 overflow-hidden ${
                      storyEffect === "glow" ? "aurora-effect-glow" : ""
                    }`}
                    style={{ opacity: effectIntensity }}
                    aria-hidden="true"
                  >
                    {storyEffect === "aurora" && (
                      <>
                        <span className="aurora-effect-wave aurora-effect-wave-one" />
                        <span className="aurora-effect-wave aurora-effect-wave-two" />
                        <span className="aurora-effect-wave aurora-effect-wave-three" />
                      </>
                    )}

                    {storyEffect === "stars" &&
                      Array.from({ length: 34 }).map((_, index) => (
                        <span
                          key={`preview-star-${index}`}
                          className="aurora-effect-star"
                          style={{
                            left: `${(index * 37) % 100}%`,
                            top: `${(index * 53) % 100}%`,
                            animationDelay: `${(index % 9) * 0.22}s`,
                            animationDuration: `${2.2 + (index % 5) * 0.55}s`,
                          }}
                        />
                      ))}

                    {storyEffect === "snow" &&
                      Array.from({ length: 28 }).map((_, index) => (
                        <span
                          key={`preview-snow-${index}`}
                          className="aurora-effect-snow"
                          style={{
                            left: `${(index * 41) % 100}%`,
                            animationDelay: `${-(index % 12) * 0.45}s`,
                            animationDuration: `${5 + (index % 7) * 0.7}s`,
                            fontSize: `${8 + (index % 5) * 3}px`,
                          }}
                        >
                          •
                        </span>
                      ))}

                    {storyEffect === "rain" &&
                      Array.from({ length: 34 }).map((_, index) => (
                        <span
                          key={`preview-rain-${index}`}
                          className="aurora-effect-rain"
                          style={{
                            left: `${(index * 29) % 100}%`,
                            animationDelay: `${-(index % 10) * 0.18}s`,
                            animationDuration: `${0.75 + (index % 5) * 0.12}s`,
                          }}
                        />
                      ))}
                  </div>
                )}

                {!isVideo &&
                  stickers.map((sticker) => (
                    <div
                      key={sticker.id}
                      className={`group absolute cursor-grab select-none touch-none active:cursor-grabbing ${
                        sticker.kind === "emoji"
                          ? ""
                          : sticker.kind === "aurora"
                            ? "rounded-2xl bg-gradient-to-r from-violet-600/90 via-fuchsia-500/90 to-cyan-400/90 px-4 py-2 font-extrabold text-white shadow-lg"
                            : "rounded-2xl bg-slate-950/80 px-4 py-2 font-extrabold text-white shadow-lg backdrop-blur"
                      }`}
                      style={{
                        left: `${sticker.x}%`,
                        top: `${sticker.y}%`,
                        transform: "translate(-50%, -50%)",
                        fontSize:
                          sticker.kind === "emoji"
                            ? `${sticker.size}px`
                            : `${Math.round(sticker.size * 0.62)}px`,
                      }}
                      onPointerDown={(event) =>
                        handleStickerPointerDown(event, sticker)
                      }
                      onPointerMove={(event) =>
                        handleStickerPointerMove(event, sticker.id)
                      }
                      onPointerUp={(event) =>
                        handleStickerPointerUp(event, sticker.id)
                      }
                      onPointerCancel={(event) =>
                        handleStickerPointerUp(event, sticker.id)
                      }
                      title="Ține apăsat pentru mutare. Dublu clic pentru ștergere."
                      onDoubleClick={() => removeSticker(sticker.id)}
                    >
                      {sticker.label}
                      <button
                        type="button"
                        className="absolute -right-2 -top-2 hidden h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-xs font-black text-white shadow group-hover:flex"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          removeSticker(sticker.id);
                        }}
                        aria-label="Șterge stickerul"
                      >
                        ×
                      </button>
                    </div>
                  ))}

                {!isVideo && overlayText.trim() && (
                  <div
                    className={`absolute max-w-[86%] cursor-grab select-none whitespace-pre-wrap rounded-2xl text-center font-extrabold leading-tight active:cursor-grabbing ${backgroundClass}`}
                    style={{
                      left: `${textX}%`,
                      top: `${textY}%`,
                      transform: "translate(-50%, -50%)",
                      fontSize: `${fontSize}px`,
                      fontFamily,
                      color: textColor,
                      textShadow: effectStyle,
                    }}
                    onPointerDown={handleTextPointerDown}
                    onPointerMove={handleTextPointerMove}
                    onPointerUp={handleTextPointerUp}
                    onPointerCancel={handleTextPointerUp}
                    title="Ține apăsat și mută textul"
                  >
                    {overlayText}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => chooseFile(null)}
                  disabled={publishing}
                  className="absolute right-3 top-3 rounded-full border border-white/25 bg-black/70 px-4 py-2 text-sm font-bold backdrop-blur transition hover:scale-105 disabled:opacity-40"
                >
                  Schimbă
                </button>
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
              className="hidden"
              onChange={handleInputChange}
            />

            {isVideo && (
              <p className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
                În Pack 2A, textul peste imagine este disponibil pentru fotografii. Video rămâne publicabil normal.
              </p>
            )}
          </div>

          <aside className="space-y-4 rounded-[26px] border border-white/10 bg-white/[0.035] p-4">
            <div>
              <label htmlFor="story-overlay-text" className="mb-2 block text-sm font-bold text-white/80">
                Text peste fotografie
              </label>
              <textarea
                id="story-overlay-text"
                value={overlayText}
                onChange={(event) => setOverlayText(event.target.value.slice(0, 120))}
                rows={3}
                placeholder="Scrie textul care va apărea pe fotografie"
                disabled={!file || isVideo || publishing}
                className="w-full resize-none rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-cyan-300/70 disabled:opacity-40"
              />
              <p className="mt-1 text-right text-xs text-white/40">{overlayText.length}/120</p>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold text-white/80">Emoji rapid</p>
              <div className="flex flex-wrap gap-2">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    disabled={!file || isVideo || publishing}
                    onClick={() => setOverlayText((current) => `${current}${emoji}`.slice(0, 120))}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-xl transition hover:scale-110 hover:bg-white/10 disabled:opacity-30"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-fuchsia-300/15 bg-fuchsia-300/[0.04] p-3">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white/85">Aurora Draw Studio</p>
                  <p className="text-xs text-white/45">
                    Desenează cu mouse-ul sau degetul
                  </p>
                </div>

                <button
                  type="button"
                  disabled={!file || isVideo || publishing}
                  onClick={() => setDrawingEnabled((current) => !current)}
                  className={`rounded-xl border px-3 py-2 text-xs font-black transition hover:scale-[1.03] disabled:opacity-30 ${
                    drawingEnabled
                      ? "border-fuchsia-300 bg-fuchsia-400/20 text-fuchsia-100"
                      : "border-white/10 bg-white/[0.05] text-white/75"
                  }`}
                >
                  {drawingEnabled ? "Desen activ" : "Activează"}
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {([
                  ["pencil", "✏️", "Creion"],
                  ["marker", "🖍️", "Marker"],
                  ["neon", "🌈", "Neon"],
                  ["eraser", "🧽", "Gumă"],
                ] as const).map(([value, icon, label]) => (
                  <button
                    key={value}
                    type="button"
                    disabled={!file || isVideo || publishing}
                    onClick={() => {
                      setDrawTool(value);
                      setDrawingEnabled(true);
                    }}
                    className={`rounded-xl border px-1 py-2 text-center transition hover:scale-[1.03] disabled:opacity-30 ${
                      drawTool === value
                        ? "border-fuchsia-300 bg-fuchsia-400/15"
                        : "border-white/10 bg-white/[0.04]"
                    }`}
                    title={label}
                  >
                    <span className="block text-lg">{icon}</span>
                    <span className="block text-[10px] font-bold">{label}</span>
                  </button>
                ))}
              </div>

              <div className="mt-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-white/70">Grosime</span>
                  <span className="text-xs text-fuchsia-200">{drawSize}px</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="36"
                  value={drawSize}
                  onChange={(event) => setDrawSize(Number(event.target.value))}
                  disabled={!file || isVideo || publishing}
                  className="w-full accent-fuchsia-300 disabled:opacity-30"
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {["#ffffff", "#111827", "#67e8f9", "#a7f3d0", "#c4b5fd", "#f9a8d4", "#fde68a", "#fb7185"].map(
                  (color) => (
                    <button
                      key={`draw-${color}`}
                      type="button"
                      aria-label={`Culoare desen ${color}`}
                      disabled={!file || isVideo || publishing || drawTool === "eraser"}
                      onClick={() => {
                        setDrawColor(color);
                        setDrawingEnabled(true);
                      }}
                      className={`h-8 w-8 rounded-full border-2 transition hover:scale-110 disabled:opacity-30 ${
                        drawColor === color ? "scale-110 border-fuchsia-300" : "border-white/20"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  )
                )}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={!file || isVideo || publishing}
                  onClick={() => drawCanvasRef.current?.undo()}
                  className="rounded-xl border border-white/10 bg-white/[0.05] px-2 py-2 text-xs font-bold transition hover:scale-[1.03] disabled:opacity-30"
                >
                  ↩ Undo
                </button>
                <button
                  type="button"
                  disabled={!file || isVideo || publishing}
                  onClick={() => drawCanvasRef.current?.redo()}
                  className="rounded-xl border border-white/10 bg-white/[0.05] px-2 py-2 text-xs font-bold transition hover:scale-[1.03] disabled:opacity-30"
                >
                  ↪ Redo
                </button>
                <button
                  type="button"
                  disabled={!file || isVideo || publishing}
                  onClick={() => drawCanvasRef.current?.clear()}
                  className="rounded-xl border border-rose-300/15 bg-rose-400/10 px-2 py-2 text-xs font-bold text-rose-100 transition hover:scale-[1.03] disabled:opacity-30"
                >
                  🧹 Șterge
                </button>
              </div>

              <p className="mt-2 text-xs text-white/40">
                Cât timp desenul este activ, textul și stickerele nu se pot muta.
              </p>
            </div>

            <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.04] p-3">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white/85">Stickere interactive</p>
                  <p className="text-xs text-white/45">Mută-le direct pe fotografie</p>
                </div>
                {stickers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setStickers([])}
                    className="text-xs font-bold text-rose-200 hover:text-rose-100"
                  >
                    Șterge toate
                  </button>
                )}
              </div>

              <div className="mb-3 flex flex-wrap gap-2">
                {STICKER_EMOJIS.map((emoji) => (
                  <button
                    key={`sticker-${emoji}`}
                    type="button"
                    disabled={!file || isVideo || publishing}
                    onClick={() => addSticker("emoji", emoji)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-xl transition hover:scale-110 hover:bg-white/10 disabled:opacity-30"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={!file || isVideo || publishing}
                  onClick={addTimeSticker}
                  className="rounded-xl border border-white/10 bg-white/[0.05] px-2 py-2 text-xs font-bold transition hover:scale-[1.03] hover:bg-white/10 disabled:opacity-30"
                >
                  🕒 Oră
                </button>
                <button
                  type="button"
                  disabled={!file || isVideo || publishing}
                  onClick={addDateSticker}
                  className="rounded-xl border border-white/10 bg-white/[0.05] px-2 py-2 text-xs font-bold transition hover:scale-[1.03] hover:bg-white/10 disabled:opacity-30"
                >
                  📅 Dată
                </button>
                <button
                  type="button"
                  disabled={!file || isVideo || publishing}
                  onClick={() => addSticker("aurora", "✨ AURORA")}
                  className="rounded-xl border border-violet-300/20 bg-gradient-to-r from-violet-500/20 to-cyan-400/20 px-2 py-2 text-xs font-bold transition hover:scale-[1.03] disabled:opacity-30"
                >
                  ✨ Aurora
                </button>
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  value={locationText}
                  onChange={(event) => setLocationText(event.target.value.slice(0, 40))}
                  disabled={!file || isVideo || publishing}
                  placeholder="Locație, de ex. Göteborg"
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-cyan-300/60 disabled:opacity-30"
                />
                <button
                  type="button"
                  disabled={!file || isVideo || publishing}
                  onClick={addLocationSticker}
                  className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-sm font-bold transition hover:scale-[1.03] disabled:opacity-30"
                >
                  📍 Adaugă
                </button>
              </div>

              <p className="mt-2 text-xs text-white/40">
                Dublu clic pe un sticker pentru ștergere.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.05] p-3">
              <div className="mb-3">
                <p className="text-sm font-bold text-white/85">Aurora Effects</p>
                <p className="text-xs text-white/45">Efecte animate peste fotografie</p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {([
                  ["none", "◯", "Fără"],
                  ["aurora", "🌌", "Aurora"],
                  ["stars", "✨", "Stele"],
                  ["snow", "❄️", "Ninsoare"],
                  ["rain", "🌧️", "Ploaie"],
                  ["glow", "💫", "Glow"],
                ] as const).map(([value, icon, label]) => (
                  <button
                    key={value}
                    type="button"
                    disabled={!file || isVideo || publishing}
                    onClick={() => setStoryEffect(value)}
                    className={`rounded-xl border px-2 py-2 text-center transition hover:scale-[1.03] disabled:opacity-30 ${
                      storyEffect === value
                        ? "border-emerald-300 bg-emerald-400/15"
                        : "border-white/10 bg-white/[0.04]"
                    }`}
                  >
                    <span className="block text-lg">{icon}</span>
                    <span className="block text-[10px] font-bold">{label}</span>
                  </button>
                ))}
              </div>

              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs font-bold text-white/65">
                  <span>Intensitate</span>
                  <span>{Math.round(effectIntensity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="1"
                  step="0.05"
                  value={effectIntensity}
                  onChange={(event) => setEffectIntensity(Number(event.target.value))}
                  disabled={!file || isVideo || publishing || storyEffect === "none"}
                  className="w-full accent-emerald-300 disabled:opacity-30"
                />
              </div>

              <p className="mt-2 text-xs text-white/40">
                Efectele sunt animate în StoryViewer și nu modifică fotografia originală.
              </p>
            </div>

            <div className="rounded-2xl border border-violet-300/20 bg-violet-300/[0.05] p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-white/85">Aurora Music Studio</p>
                  <p className="text-xs text-white/45">Adaugă o melodie proprie la poveste</p>
                </div>
                <button
                  type="button"
                  disabled={!file || publishing}
                  onClick={() => audioInputRef.current?.click()}
                  className="rounded-xl border border-violet-300/25 bg-violet-400/15 px-3 py-2 text-xs font-black transition hover:scale-[1.03] disabled:opacity-30"
                >
                  🎵 {audioFile ? "Schimbă" : "Alege"}
                </button>
              </div>

              <input
                ref={audioInputRef}
                type="file"
                accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/mp4,audio/aac,audio/x-m4a"
                className="hidden"
                onChange={handleAudioInputChange}
              />

              {audioPreviewUrl ? (
                <div className="space-y-3">
                  <audio
                    ref={audioPreviewRef}
                    src={audioPreviewUrl}
                    preload="metadata"
                    onLoadedMetadata={(event) => {
                      const duration = Number.isFinite(event.currentTarget.duration)
                        ? event.currentTarget.duration
                        : 0;
                      setAudioDuration(duration);
                      setAudioStart((current) => Math.min(current, Math.max(0, duration - 1)));
                    }}
                  />

                  <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                    <p className="truncate text-sm font-bold text-violet-100">
                      🎧 {audioTitle || audioFile?.name}
                    </p>
                    <p className="mt-1 text-xs text-white/40">
                      {audioFile ? `${(audioFile.size / 1024 / 1024).toFixed(1)} MB` : ""}
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-white/65">
                      Titlu afișat
                    </label>
                    <input
                      value={audioTitle}
                      onChange={(event) => setAudioTitle(event.target.value.slice(0, 80))}
                      disabled={publishing}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm outline-none focus:border-violet-300/60"
                      placeholder="Titlul melodiei"
                    />
                  </div>

                  <div>
                    <div className="mb-1 flex justify-between text-xs font-bold text-white/65">
                      <span>Pornește de la</span>
                      <span>{audioStart.toFixed(1)} sec</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={Math.max(0, audioDuration - 1)}
                      step="0.5"
                      value={Math.min(audioStart, Math.max(0, audioDuration - 1))}
                      onChange={(event) => setAudioStart(Number(event.target.value))}
                      disabled={publishing || audioDuration <= 1}
                      className="w-full accent-violet-300 disabled:opacity-30"
                    />
                  </div>

                  <div>
                    <div className="mb-1 flex justify-between text-xs font-bold text-white/65">
                      <span>Volum melodie</span>
                      <span>{Math.round(audioVolume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={audioVolume}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        setAudioVolume(value);
                        if (audioPreviewRef.current) audioPreviewRef.current.volume = value;
                      }}
                      disabled={publishing}
                      className="w-full accent-violet-300"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button type="button" onClick={previewAudio} className="rounded-xl border border-white/10 bg-white/[0.05] px-2 py-2 text-xs font-bold hover:bg-white/10">
                      ▶ Ascultă
                    </button>
                    <button type="button" onClick={pauseAudio} className="rounded-xl border border-white/10 bg-white/[0.05] px-2 py-2 text-xs font-bold hover:bg-white/10">
                      ⏸ Pauză
                    </button>
                    <button
                      type="button"
                      onClick={() => chooseAudio(null)}
                      className="rounded-xl border border-rose-300/15 bg-rose-400/10 px-2 py-2 text-xs font-bold text-rose-100"
                    >
                      ✕ Elimină
                    </button>
                  </div>
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-white/10 px-3 py-3 text-xs text-white/45">
                  Fără melodie. Povestea va fi publicată normal.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="story-font" className="mb-2 block text-sm font-bold text-white/80">
                Font
              </label>
              <select
                id="story-font"
                value={fontFamily}
                onChange={(event) => setFontFamily(event.target.value)}
                disabled={!file || isVideo || publishing}
                className="w-full rounded-2xl border border-white/15 bg-slate-900 px-4 py-3 text-white outline-none disabled:opacity-40"
              >
                {FONT_OPTIONS.map((font) => (
                  <option key={font.label} value={font.value}>{font.label}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="story-font-size" className="text-sm font-bold text-white/80">
                  Mărime
                </label>
                <span className="text-xs text-cyan-200">{fontSize}px</span>
              </div>
              <input
                id="story-font-size"
                type="range"
                min="22"
                max="72"
                value={fontSize}
                onChange={(event) => setFontSize(Number(event.target.value))}
                disabled={!file || isVideo || publishing}
                className="w-full accent-cyan-300 disabled:opacity-40"
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-bold text-white/80">Culoare text</p>
              <div className="flex flex-wrap gap-2">
                {TEXT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Culoare ${color}`}
                    onClick={() => setTextColor(color)}
                    disabled={!file || isVideo || publishing}
                    className={`h-9 w-9 rounded-full border-2 transition hover:scale-110 disabled:opacity-30 ${
                      textColor === color ? "border-cyan-300 scale-110" : "border-white/20"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold text-white/80">Fundal text</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ["none", "Fără"],
                  ["dark", "Închis"],
                  ["light", "Deschis"],
                  ["aurora", "Aurora"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTextBackground(value)}
                    disabled={!file || isVideo || publishing}
                    className={`rounded-xl border px-3 py-2 text-sm font-bold transition hover:scale-[1.03] disabled:opacity-30 ${
                      textBackground === value
                        ? "border-cyan-300 bg-cyan-300/15"
                        : "border-white/10 bg-white/[0.04]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold text-white/80">Efect</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ["none", "Fără"],
                  ["shadow", "Umbră"],
                  ["glow", "Glow"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTextEffect(value)}
                    disabled={!file || isVideo || publishing}
                    className={`rounded-xl border px-2 py-2 text-sm font-bold transition hover:scale-[1.03] disabled:opacity-30 ${
                      textEffect === value
                        ? "border-violet-300 bg-violet-400/15"
                        : "border-white/10 bg-white/[0.04]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="story-caption" className="mb-2 block text-sm font-bold text-white/80">
                Descriere sub poveste
              </label>
              <textarea
                id="story-caption"
                value={caption}
                onChange={(event) => setCaption(event.target.value.slice(0, 220))}
                rows={3}
                placeholder="Text opțional afișat sub fotografie"
                disabled={publishing}
                className="w-full resize-none rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-cyan-300/70 disabled:opacity-40"
              />
              <p className="mt-1 text-right text-xs text-white/40">{caption.length}/220</p>
            </div>
          </aside>
        </div>

        {errorMessage && (
          <div className="mx-5 mb-4 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 sm:mx-6">
            {errorMessage}
          </div>
        )}

        <footer className="flex flex-col-reverse gap-3 border-t border-white/10 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={publishing}
            className="rounded-2xl border border-white/15 px-5 py-3 font-bold text-white/80 transition hover:scale-[1.02] hover:bg-white/10 disabled:opacity-40"
          >
            Renunță
          </button>

          <button
            type="submit"
            disabled={!file || publishing}
            className="rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 px-6 py-3 font-black text-white shadow-lg shadow-violet-500/20 transition hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {publishing ? "Se procesează și se publică..." : "Publică povestea"}
          </button>
        </footer>
      </form>

      <style jsx>{`
        .aurora-effect-wave {
          position: absolute;
          width: 150%;
          height: 42%;
          left: -25%;
          border-radius: 50%;
          filter: blur(24px);
          mix-blend-mode: screen;
          animation: auroraWave 6s ease-in-out infinite alternate;
        }
        .aurora-effect-wave-one {
          top: 4%;
          background: linear-gradient(90deg, transparent, #7c3aed, #22d3ee, transparent);
        }
        .aurora-effect-wave-two {
          top: 28%;
          background: linear-gradient(90deg, transparent, #10b981, #d946ef, transparent);
          animation-delay: -2s;
        }
        .aurora-effect-wave-three {
          top: 54%;
          background: linear-gradient(90deg, transparent, #06b6d4, #8b5cf6, transparent);
          animation-delay: -4s;
        }
        .aurora-effect-star {
          position: absolute;
          width: 4px;
          height: 4px;
          border-radius: 999px;
          background: white;
          box-shadow: 0 0 8px white;
          animation: auroraTwinkle 3s ease-in-out infinite;
        }
        .aurora-effect-snow {
          position: absolute;
          top: -10%;
          color: white;
          text-shadow: 0 0 6px white;
          animation: auroraSnow linear infinite;
        }
        .aurora-effect-rain {
          position: absolute;
          top: -15%;
          width: 2px;
          height: 38px;
          border-radius: 999px;
          background: linear-gradient(to bottom, transparent, rgba(186,230,253,.95));
          transform: rotate(10deg);
          animation: auroraRain linear infinite;
        }
        .aurora-effect-glow {
          box-shadow: inset 0 0 90px rgba(34,211,238,.55), inset 0 0 140px rgba(168,85,247,.42);
          animation: auroraGlow 3s ease-in-out infinite alternate;
        }
        @keyframes auroraWave {
          from { transform: translate3d(-8%, -4%, 0) rotate(-5deg) scale(1); }
          to { transform: translate3d(8%, 8%, 0) rotate(6deg) scale(1.12); }
        }
        @keyframes auroraTwinkle {
          0%, 100% { opacity: .18; transform: scale(.7); }
          50% { opacity: 1; transform: scale(1.6); }
        }
        @keyframes auroraSnow {
          from { transform: translate3d(0, -10%, 0); }
          to { transform: translate3d(32px, 120vh, 0); }
        }
        @keyframes auroraRain {
          from { transform: translate3d(0, -15%, 0) rotate(10deg); }
          to { transform: translate3d(-24px, 120vh, 0) rotate(10deg); }
        }
        @keyframes auroraGlow {
          from { opacity: .55; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
