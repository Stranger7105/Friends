"use client";

import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type RefObject,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ImagePlus,
  LoaderCircle,
  MapPin,
  Send,
  Smile,
  Sparkles,
  UploadCloud,
  Video,
  X,
} from "lucide-react";

type AuroraComposerProps = {
  postText: string;
  selectedImage: File | null;
  previewUrl: string | null;
  publishing: boolean;
  imageInputRef: RefObject<HTMLInputElement | null>;
  onPostTextChange: (value: string) => void;
  onImageSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onDroppedImage: (file: File) => void;
  onRemoveImage: () => void;
  onPublish: (event: FormEvent<HTMLFormElement>) => void;
};

const secondaryActions = [
  { label: "Video", icon: Video },
  { label: "Stare", icon: Smile },
  { label: "Locație", icon: MapPin },
];

export default function AuroraComposer({
  postText,
  selectedImage,
  previewUrl,
  publishing,
  imageInputRef,
  onPostTextChange,
  onImageSelect,
  onDroppedImage,
  onRemoveImage,
  onPublish,
}: AuroraComposerProps) {
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current -= 1;

    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragging(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (file) onDroppedImage(file);
  }

  const canPublish =
    !publishing && Boolean(postText.trim() || selectedImage);

  return (
    <motion.form
      onSubmit={onPublish}
      initial={{ opacity: 0, y: 20, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="group relative mb-8 overflow-hidden rounded-[34px] border border-white/80 bg-white/56 p-1.5 shadow-[0_32px_100px_-52px_rgba(76,29,149,0.55)] backdrop-blur-[32px]"
    >
      <div className="pointer-events-none absolute -left-20 -top-20 h-52 w-52 rounded-full bg-emerald-400/22 blur-3xl" />
      <div className="pointer-events-none absolute -right-14 top-3 h-44 w-44 rounded-full bg-lime-300/18 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-36 w-56 rounded-full bg-lime-300/14 blur-3xl" />

      <div className="relative rounded-[28px] border border-white/65 bg-white/58 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-start gap-4">
          <motion.div
            whileHover={{ y: -2, rotate: -4, scale: 1.06 }}
            transition={{ type: "spring", stiffness: 380, damping: 22 }}
            className="mt-1 grid h-12 w-12 shrink-0 place-items-center rounded-[18px] border border-white/75 bg-gradient-to-br from-emerald-700 via-emerald-500 to-lime-400 text-white shadow-[0_18px_38px_-20px_rgba(0,168,107,0.9)]"
          >
            <Sparkles size={22} />
          </motion.div>

          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-[17px] font-black tracking-[-0.025em] text-slate-900 sm:text-lg">
                  Spune ceva oamenilor tăi
                </h2>
                <p className="text-xs text-slate-500 sm:text-sm">
                  Un gând, o fotografie sau un moment.
                </p>
              </div>

              <span className="hidden rounded-full border border-white/75 bg-white/65 px-3 py-1.5 text-[10px] font-extrabold tracking-[0.12em] text-slate-400 shadow-sm sm:block">
                AURORA
              </span>
            </div>

            <div
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative overflow-hidden rounded-[24px] border transition-all duration-300 ${
                dragging
                  ? "border-emerald-400 bg-emerald-50/90 shadow-[0_0_0_5px_rgba(16,185,129,0.12)]"
                  : "border-slate-200/75 bg-white/62"
              }`}
            >
              <textarea
                value={postText}
                onChange={(event) => onPostTextChange(event.target.value)}
                placeholder="Ce ai în minte?"
                maxLength={5000}
                className="min-h-32 w-full resize-none bg-transparent px-5 pb-11 pt-5 text-[16px] leading-7 text-slate-800 outline-none placeholder:text-slate-400 sm:min-h-36"
              />

              <div className="pointer-events-none absolute bottom-3 right-4 rounded-full bg-white/72 px-2.5 py-1 text-[11px] font-semibold text-slate-400 shadow-sm backdrop-blur">
                {postText.length}/5000
              </div>

              <AnimatePresence>
                {dragging && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-md"
                  >
                    <motion.div
                      animate={{ y: [0, -6, 0] }}
                      transition={{ duration: 1.15, repeat: Infinity }}
                      className="flex flex-col items-center gap-2 text-emerald-700"
                    >
                      <UploadCloud size={34} />
                      <span className="font-bold">Lasă fotografia aici</span>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {previewUrl && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="relative mt-4 overflow-hidden rounded-[26px] border border-white/75 bg-slate-950/5 p-2 shadow-inner"
            >
              <img
                src={previewUrl}
                alt="Previzualizarea fotografiei"
                className="max-h-[500px] w-full rounded-[20px] object-contain"
              />

              <button
                type="button"
                onClick={onRemoveImage}
                aria-label="Elimină fotografia"
                title="Elimină fotografia"
                className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-white/70 bg-slate-950/62 text-white shadow-lg backdrop-blur-md transition hover:scale-110 hover:bg-rose-500"
              >
                <X size={19} />
              </button>

              <div className="absolute bottom-4 left-4 max-w-[72%] truncate rounded-full border border-white/50 bg-slate-950/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
                {selectedImage?.name}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-4 flex flex-col gap-3 border-t border-slate-200/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <motion.button
              type="button"
              whileHover={{ y: -3, scale: 1.055 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => imageInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-3.5 py-2.5 text-sm font-extrabold text-emerald-700 shadow-sm transition hover:bg-emerald-100"
            >
              <ImagePlus size={18} />
              Fotografie
            </motion.button>

            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={onImageSelect}
              className="hidden"
            />

            {secondaryActions.map(({ label, icon: Icon }) => (
              <motion.button
                key={label}
                type="button"
                whileHover={{ y: -3, scale: 1.07 }}
                whileTap={{ scale: 0.95 }}
                title={`${label} — disponibil în curând`}
                className="grid h-10 w-10 place-items-center rounded-2xl border border-slate-200/75 bg-white/70 text-slate-500 shadow-sm transition hover:border-lime-200 hover:bg-lime-50 hover:text-emerald-700"
              >
                <Icon size={18} />
              </motion.button>
            ))}

            <span className="hidden text-[11px] font-medium text-slate-400 lg:inline">
              JPG, PNG, WEBP sau GIF · maximum 10 MB
            </span>
          </div>

          <motion.button
            type="submit"
            disabled={!canPublish}
            whileHover={canPublish ? { y: -3, scale: 1.04 } : undefined}
            whileTap={canPublish ? { scale: 0.96 } : undefined}
            className="inline-flex min-w-36 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-500 to-lime-400 px-6 py-3 font-black text-white shadow-[0_16px_34px_-16px_rgba(0,168,107,0.82)] transition disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none"
          >
            {publishing ? (
              <LoaderCircle size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
            {publishing ? "Se publică..." : "Publică"}
          </motion.button>
        </div>
      </div>
    </motion.form>
  );
}
