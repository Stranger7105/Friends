"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";

type StoryCanvasProps = {
  imageUrl: string | null;
  onSelectImage: (file: File) => void;
  onRemoveImage: () => void;
};

export default function StoryCanvas({
  imageUrl,
  onSelectImage,
  onRemoveImage,
}: StoryCanvasProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  function useFile(file: File | undefined) {
    if (!file) return;

    try {
      onSelectImage(file);
      setError("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Fotografia nu a putut fi deschisă.",
      );
    }
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    useFile(event.target.files?.[0]);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    useFile(event.dataTransfer.files?.[0]);
  }

  return (
    <main className="aurora-studio-canvas-column">
      <div
        className={`aurora-studio-canvas ${
          dragging ? "aurora-studio-canvas-dragging" : ""
        }`}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          if (event.currentTarget === event.target) {
            setDragging(false);
          }
        }}
        onDrop={handleDrop}
      >
        {imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt="Fotografia Story-ului"
              className="aurora-studio-photo"
              draggable={false}
            />

            <div className="aurora-studio-canvas-glow" aria-hidden="true" />

            <button
              type="button"
              className="aurora-studio-remove-photo"
              onClick={onRemoveImage}
            >
              Schimbă fotografia
            </button>
          </>
        ) : (
          <button
            type="button"
            className="aurora-studio-upload-area"
            onClick={() => inputRef.current?.click()}
          >
            <span className="aurora-studio-upload-icon">＋</span>
            <strong>Alege o fotografie</strong>
            <span>sau trage fotografia aici</span>
            <small>JPG, PNG sau WEBP · maximum 15 MB</small>
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleInput}
          hidden
        />
      </div>

      {error && <p className="aurora-studio-error">{error}</p>}
    </main>
  );
}
