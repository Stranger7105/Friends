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

const actions = [
  { label: "Foto / Video", icon: ImagePlus, primary: true },
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
  const [focused, setFocused] = useState(false);
  const dragDepth = useRef(0);

  const expanded = focused || Boolean(postText.trim()) || Boolean(selectedImage);
  const canPublish = !publishing && Boolean(postText.trim() || selectedImage);

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

  return (
    <motion.form
      onSubmit={onPublish}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
      className="aurora-composer-motion aurora-composer-print"
    >
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`aurora-composer-print-inner ${dragging ? "is-dragging" : ""}`}
      >
        <div className="aurora-composer-print-head">
          <div className="aurora-composer-print-avatar">
            <Sparkles size={18} />
          </div>

          <div className="aurora-composer-print-title">
            <span>SPUNE CEVA PRIETENILOR TĂI</span>
            <strong>Spune ceva prietenilor tăi</strong>
            <p>Un gând, o fotografie sau un moment.</p>
          </div>

          <span className="aurora-composer-print-badge">AURORA ✦</span>
        </div>

        <div className={`aurora-composer-print-input ${expanded ? "is-expanded" : ""}`}>
          <textarea
            value={postText}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              if (!postText.trim() && !selectedImage) setFocused(false);
            }}
            onChange={(event) => onPostTextChange(event.target.value)}
            placeholder="Ce ai în minte?"
            maxLength={5000}
            rows={expanded ? 3 : 1}
          />

          {expanded && (
            <span className="aurora-composer-print-count">
              {postText.length}/5000
            </span>
          )}
        </div>

        <AnimatePresence>
          {dragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="aurora-composer-print-drop"
            >
              <UploadCloud size={30} />
              <strong>Lasă fotografia aici</strong>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {previewUrl && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: 6 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: 6 }}
              className="aurora-composer-print-preview"
            >
              <img src={previewUrl} alt="Previzualizarea fotografiei" />

              <button
                type="button"
                onClick={onRemoveImage}
                aria-label="Elimină fotografia"
                title="Elimină fotografia"
              >
                <X size={18} />
              </button>

              <span>{selectedImage?.name}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="aurora-composer-print-actions">
          <div className="aurora-composer-print-tools">
            {actions.map(({ label, icon: Icon, primary }) => (
              <motion.button
                key={label}
                type="button"
                whileHover={{ y: -2, scale: 1.035 }}
                whileTap={{ scale: 0.96 }}
                onClick={primary ? () => imageInputRef.current?.click() : undefined}
                title={primary ? label : `${label} — disponibil în curând`}
              >
                <Icon size={17} />
                <span>{label}</span>
              </motion.button>
            ))}

            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={onImageSelect}
              className="hidden"
            />
          </div>

          <motion.button
            type="submit"
            disabled={!canPublish}
            whileHover={canPublish ? { y: -2, scale: 1.025 } : undefined}
            whileTap={canPublish ? { scale: 0.97 } : undefined}
            className="aurora-composer-print-publish"
          >
            {publishing ? (
              <LoaderCircle size={17} className="animate-spin" />
            ) : (
              <Send size={17} />
            )}
            <span>{publishing ? "Se publică..." : "Publică"}</span>
          </motion.button>
        </div>
      </div>
    </motion.form>
  );
}