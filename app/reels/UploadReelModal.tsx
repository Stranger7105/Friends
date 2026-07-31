"use client";

import {
  CheckCircle2,
  Film,
  ImageIcon,
  LoaderCircle,
  MapPin,
  Music2,
  UploadCloud,
  X,
} from "lucide-react";
import {
  ChangeEvent,
  DragEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type UploadReelModalProps = {
  open: boolean;
  onClose: () => void;
  onPublished: () => void;
};

type Visibility = "public" | "friends" | "private";

const MAX_VIDEO_SIZE = 250 * 1024 * 1024;
const ACCEPTED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
];

function safeFileName(name: string) {
  const extension = name.includes(".") ? name.split(".").pop() : "mp4";
  const stem = name
    .replace(/\.[^/.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  return `${stem || "reel"}.${extension || "mp4"}`;
}

function createThumbnail(videoFile: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const url = URL.createObjectURL(videoFile);

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.remove();
      canvas.remove();
    };

    video.onerror = () => {
      cleanup();
      resolve(null);
    };

    video.onloadedmetadata = () => {
      const targetTime = Math.min(
        Math.max(video.duration * 0.12, 0.2),
        Math.max(video.duration - 0.1, 0.2)
      );

      video.currentTime = Number.isFinite(targetTime) ? targetTime : 0.2;
    };

    video.onseeked = () => {
      const maxWidth = 720;
      const ratio =
        video.videoWidth > maxWidth ? maxWidth / video.videoWidth : 1;

      canvas.width = Math.max(1, Math.round(video.videoWidth * ratio));
      canvas.height = Math.max(1, Math.round(video.videoHeight * ratio));

      const context = canvas.getContext("2d");
      if (!context) {
        cleanup();
        resolve(null);
        return;
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          cleanup();
          resolve(blob);
        },
        "image/jpeg",
        0.84
      );
    };
  });
}

export default function UploadReelModal({
  open,
  onClose,
  onPublished,
}: UploadReelModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState("");
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState("");
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [musicTitle, setMusicTitle] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [dragging, setDragging] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [published, setPublished] = useState(false);

  const canPublish = useMemo(
    () => Boolean(videoFile) && !preparing && !publishing,
    [videoFile, preparing, publishing]
  );

  useEffect(() => {
    if (!open) return;

    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !publishing) onClose();
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeWithEscape);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeWithEscape);
    };
  }, [onClose, open, publishing]);

  useEffect(() => {
    return () => {
      if (videoPreview) URL.revokeObjectURL(videoPreview);
      if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    };
  }, [thumbnailPreview, videoPreview]);

  function resetForm() {
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);

    setVideoFile(null);
    setVideoPreview("");
    setThumbnailBlob(null);
    setThumbnailPreview("");
    setCaption("");
    setLocation("");
    setMusicTitle("");
    setVisibility("public");
    setDragging(false);
    setPreparing(false);
    setPublishing(false);
    setProgress(0);
    setErrorMessage("");
    setPublished(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function closeModal() {
    if (publishing) return;
    resetForm();
    onClose();
  }

  async function prepareVideo(file: File) {
    setErrorMessage("");
    setPublished(false);

    if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
      setErrorMessage(
        "Format neacceptat. Folosește MP4, MOV, M4V sau WebM."
      );
      return;
    }

    if (file.size > MAX_VIDEO_SIZE) {
      setErrorMessage("Videoclipul poate avea maximum 250 MB.");
      return;
    }

    if (videoPreview) URL.revokeObjectURL(videoPreview);
    if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);

    const preview = URL.createObjectURL(file);

    setVideoFile(file);
    setVideoPreview(preview);
    setThumbnailBlob(null);
    setThumbnailPreview("");
    setPreparing(true);

    try {
      const thumbnail = await createThumbnail(file);

      if (thumbnail) {
        const thumbPreview = URL.createObjectURL(thumbnail);
        setThumbnailBlob(thumbnail);
        setThumbnailPreview(thumbPreview);
      }
    } catch (error) {
      console.warn("Thumbnail generation warning:", error);
    } finally {
      setPreparing(false);
    }
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void prepareVideo(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (file) void prepareVideo(file);
  }

  async function publishReel() {
    if (!videoFile || publishing) return;

    setPublishing(true);
    setErrorMessage("");
    setPublished(false);
    setProgress(8);

    let videoPath = "";
    let thumbnailPath = "";

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Sesiunea a expirat. Autentifică-te din nou.");
      }

      const uniqueId = crypto.randomUUID();
      const videoName = safeFileName(videoFile.name);
      videoPath = `${user.id}/${uniqueId}/${videoName}`;
      thumbnailPath = `${user.id}/${uniqueId}/thumbnail.jpg`;

      setProgress(20);

      const { error: videoUploadError } = await supabase.storage
        .from("reels")
        .upload(videoPath, videoFile, {
          cacheControl: "3600",
          contentType: videoFile.type || "video/mp4",
          upsert: false,
        });

      if (videoUploadError) {
        throw new Error(`Upload video: ${videoUploadError.message}`);
      }

      setProgress(58);

      let thumbnailUrl: string | null = null;

      if (thumbnailBlob) {
        const { error: thumbnailUploadError } = await supabase.storage
          .from("reels")
          .upload(thumbnailPath, thumbnailBlob, {
            cacheControl: "3600",
            contentType: "image/jpeg",
            upsert: false,
          });

        if (thumbnailUploadError) {
          console.warn(
            "Thumbnail upload warning:",
            thumbnailUploadError.message
          );
        } else {
          const { data } = supabase.storage
            .from("reels")
            .getPublicUrl(thumbnailPath);

          thumbnailUrl = data.publicUrl;
        }
      }

      setProgress(76);

      const { data: videoPublicData } = supabase.storage
        .from("reels")
        .getPublicUrl(videoPath);

      const { error: insertError } = await supabase.from("reels").insert({
        user_id: user.id,
        video_url: videoPublicData.publicUrl,
        thumbnail_url: thumbnailUrl,
        caption: caption.trim() || null,
        location: location.trim() || null,
        music_title: musicTitle.trim() || null,
        visibility,
      });

      if (insertError) {
        throw new Error(`Publicare Reel: ${insertError.message}`);
      }

      setProgress(100);
      setPublished(true);

      window.setTimeout(() => {
        resetForm();
        onPublished();
      }, 850);
    } catch (error) {
      console.error("Publish Reel error:", error);

      if (videoPath) {
        const paths = [videoPath];
        if (thumbnailBlob && thumbnailPath) paths.push(thumbnailPath);
        void supabase.storage.from("reels").remove(paths);
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Reel-ul nu a putut fi publicat."
      );
      setProgress(0);
    } finally {
      setPublishing(false);
    }
  }

  if (!open) return null;

  return (
    <div className="reel-upload-overlay" role="presentation" onMouseDown={closeModal}>
      <section
        className="reel-upload-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reel-upload-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="reel-upload-header">
          <div>
            <span>FRIENDS CREATOR</span>
            <h2 id="reel-upload-title">Publică un Reel</h2>
          </div>

          <button
            type="button"
            onClick={closeModal}
            disabled={publishing}
            aria-label="Închide"
          >
            <X />
          </button>
        </header>

        <div className="reel-upload-content">
          <div className="reel-upload-media-column">
            {!videoFile ? (
              <div
                className={`reel-drop-zone${dragging ? " is-dragging" : ""}`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setDragging(false);
                }}
                onDrop={handleDrop}
              >
                <div className="reel-drop-icon">
                  <UploadCloud />
                </div>
                <h3>Trage videoclipul aici</h3>
                <p>sau alege-l de pe calculator</p>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Alege videoclip
                </button>

                <small>MP4, MOV, M4V sau WebM • maximum 250 MB</small>
              </div>
            ) : (
              <div className="reel-upload-preview">
                <video
                  src={videoPreview}
                  controls
                  muted
                  playsInline
                  preload="metadata"
                />

                <div className="reel-preview-toolbar">
                  <span>
                    <Film />
                    {videoFile.name}
                  </span>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={publishing}
                  >
                    Schimbă
                  </button>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
              hidden
              onChange={handleFileInput}
            />

            {videoFile && (
              <div className="reel-thumbnail-card">
                <div className="reel-thumbnail-image">
                  {thumbnailPreview ? (
                    <img src={thumbnailPreview} alt="Coperta Reel-ului" />
                  ) : (
                    <ImageIcon />
                  )}

                  {preparing && (
                    <span>
                      <LoaderCircle className="reels-spin" />
                    </span>
                  )}
                </div>

                <div>
                  <strong>Copertă automată</strong>
                  <p>
                    Este extras un cadru din videoclip și folosit înainte de
                    pornirea playerului.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="reel-upload-form">
            <label>
              <span>Descriere</span>
              <textarea
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                placeholder="Spune ceva prietenilor tăi..."
                maxLength={1000}
                rows={5}
                disabled={publishing}
              />
              <small>{caption.length}/1000</small>
            </label>

            <label>
              <span>
                <Music2 />
                Muzică sau sunet
              </span>
              <input
                value={musicTitle}
                onChange={(event) => setMusicTitle(event.target.value)}
                placeholder="Exemplu: Sunet original"
                maxLength={120}
                disabled={publishing}
              />
            </label>

            <label>
              <span>
                <MapPin />
                Locație
              </span>
              <input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Adaugă o locație"
                maxLength={120}
                disabled={publishing}
              />
            </label>

            <label>
              <span>Vizibilitate</span>
              <select
                value={visibility}
                onChange={(event) =>
                  setVisibility(event.target.value as Visibility)
                }
                disabled={publishing}
              >
                <option value="public">Public</option>
                <option value="friends">Doar prietenii</option>
                <option value="private">Doar eu</option>
              </select>
            </label>

            {errorMessage && (
              <div className="reel-upload-message is-error">
                {errorMessage}
              </div>
            )}

            {published && (
              <div className="reel-upload-message is-success">
                <CheckCircle2 />
                Reel publicat cu succes
              </div>
            )}

            {(publishing || progress > 0) && !published && (
              <div className="reel-upload-progress">
                <div>
                  <span>Se publică Reel-ul...</span>
                  <strong>{progress}%</strong>
                </div>
                <span>
                  <i style={{ width: `${progress}%` }} />
                </span>
              </div>
            )}
          </div>
        </div>

        <footer className="reel-upload-footer">
          <button
            type="button"
            className="reel-upload-cancel"
            onClick={closeModal}
            disabled={publishing}
          >
            Anulează
          </button>

          <button
            type="button"
            className="reel-upload-publish"
            onClick={() => void publishReel()}
            disabled={!canPublish}
          >
            {publishing ? (
              <>
                <LoaderCircle className="reels-spin" />
                Se publică...
              </>
            ) : (
              <>
                <UploadCloud />
                Publică Reel
              </>
            )}
          </button>
        </footer>
      </section>
    </div>
  );
}