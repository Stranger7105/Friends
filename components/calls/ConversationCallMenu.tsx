"use client";

import { useEffect, useRef, useState } from "react";

export type CallKind = "audio" | "video";

type Props = {
  disabled?: boolean;
  onStartCall: (kind: CallKind) => void;
  onOpenMedia: () => void;
  onOpenAppearance: () => void;
};

export default function ConversationCallMenu({
  disabled = false,
  onStartCall,
  onOpenMedia,
  onOpenAppearance,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function closeOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={() => onStartCall("video")}
        disabled={disabled}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-200 bg-white/90 text-xl text-emerald-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
        title="Apel video"
        aria-label="Pornește un apel video"
      >
        📹
      </button>

      <button
        type="button"
        onClick={() => onStartCall("audio")}
        disabled={disabled}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-200 bg-white/90 text-xl text-emerald-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
        title="Apel audio"
        aria-label="Pornește un apel audio"
      >
        📞
      </button>

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-200 bg-white/90 text-2xl font-bold text-emerald-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-50"
        title="Mai multe opțiuni"
        aria-label="Mai multe opțiuni"
        aria-expanded={open}
      >
        ⋮
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-[70] w-64 overflow-hidden rounded-2xl border border-emerald-100 bg-white py-2 text-sm text-gray-800 shadow-2xl">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpenMedia();
            }}
            className="flex w-full items-center gap-3 px-4 py-3 text-left font-semibold transition hover:bg-emerald-50"
          >
            <span className="text-lg">🖼️</span>
            Media, documente și audio
          </button>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpenAppearance();
            }}
            className="flex w-full items-center gap-3 px-4 py-3 text-left font-semibold transition hover:bg-emerald-50"
          >
            <span className="text-lg">🎨</span>
            Tema conversației
          </button>
        </div>
      )}
    </div>
  );
}
