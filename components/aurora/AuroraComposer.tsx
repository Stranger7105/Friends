"use client";

import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Globe2,
  ImagePlus,
  LoaderCircle,
  Lock,
  MapPin,
  Send,
  Smile,
  Sparkles,
  UploadCloud,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

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

type ComposerProfile = {
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type FriendGroup = {
  id: string;
  name: string;
};

type Audience =
  | { type: "all"; label: "Toți prietenii" }
  | { type: "private"; label: "Doar eu" }
  | { type: "group"; groupId: string; label: string };

const actions = [
  { label: "Foto", icon: ImagePlus, media: true },
  { label: "Video", icon: Video, media: true },
  { label: "Stare", icon: Smile, media: false },
  { label: "Locație", icon: MapPin, media: false },
];

function displayName(profile: ComposerProfile | null) {
  return profile?.full_name || profile?.username || "Prieten";
}

function initials(profile: ComposerProfile | null) {
  return displayName(profile)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

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
  const [profile, setProfile] = useState<ComposerProfile | null>(null);
  const [groups, setGroups] = useState<FriendGroup[]>([]);
  const [audience, setAudience] = useState<Audience>({
    type: "all",
    label: "Toți prietenii",
  });

  const dragDepth = useRef(0);

  const expanded =
    focused || Boolean(postText.trim()) || Boolean(selectedImage) || dragging;

  const canPublish = !publishing && Boolean(postText.trim() || selectedImage);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();

    if (hour < 11) return "Bună dimineața";
    if (hour < 18) return "Bună ziua";
    return "Bună seara";
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadComposerIdentity() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || cancelled) return;

      const [profileResult, groupsResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("username, full_name, avatar_url")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("friend_groups")
          .select("id, name")
          .eq("owner_id", user.id)
          .order("name", { ascending: true }),
      ]);

      if (!cancelled && !profileResult.error) {
        setProfile((profileResult.data || null) as ComposerProfile | null);
      }

      if (!cancelled && !groupsResult.error) {
        setGroups((groupsResult.data || []) as FriendGroup[]);
      }
    }

    void loadComposerIdentity();

    return () => {
      cancelled = true;
    };
  }, []);


  function handleAudienceChange(value: string) {
    if (value === "friends") {
      setAudience({ type: "all", label: "Toți prietenii" });
      return;
    }

    if (value === "private") {
      setAudience({ type: "private", label: "Doar eu" });
      return;
    }

    if (value.startsWith("group:")) {
      const groupId = value.slice("group:".length);
      const group = groups.find((item) => item.id === groupId);

      if (group) {
        setAudience({
          type: "group",
          groupId: group.id,
          label: group.name,
        });
      }
    }
  }

  const audienceValue =
    audience.type === "all"
      ? "friends"
      : audience.type === "private"
        ? "private"
        : `group:${audience.groupId}`;

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
    setFocused(true);
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

  function audienceIcon() {
    if (audience.type === "private") return <Lock size={15} />;
    if (audience.type === "group") return <UsersRound size={15} />;
    return <Globe2 size={15} />;
  }

  return (
    <motion.form
      onSubmit={onPublish}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      className={`aurora-composer-c21 aurora-composer-c22 ${
        expanded ? "is-expanded" : ""
      }`}
    >
      <div
        className={`aurora-composer-c21-inner ${
          dragging ? "is-dragging" : ""
        }`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="aurora-composer-c21-head">
          <div className="aurora-composer-c21-avatar aurora-composer-c22-avatar">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" />
            ) : (
              <span>{initials(profile)}</span>
            )}
          </div>

          <div className="aurora-composer-c21-copy">
            <span>
              {greeting}, {displayName(profile)}!
            </span>
            <strong>Ce ai în minte astăzi?</strong>
          </div>

          <div className="aurora-composer-c21-badge">
            <Sparkles size={13} />
            Friends
          </div>
        </div>

        <div className="aurora-composer-c21-field">
          <textarea
            value={postText}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              if (!postText.trim() && !selectedImage && !dragging) {
                setFocused(false);
              }
            }}
            onChange={(event) => onPostTextChange(event.target.value)}
            placeholder="Scrie ceva prietenilor tăi..."
            maxLength={5000}
            rows={expanded ? 4 : 1}
          />

          {expanded && (
            <span className="aurora-composer-c21-count">
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
              className="aurora-composer-c21-drop"
            >
              <UploadCloud size={34} />
              <strong>Lasă fotografia sau videoclipul aici</strong>
              <span>Fișierul va fi adăugat postării tale.</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {previewUrl && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: 8 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: 8 }}
              className="aurora-composer-c21-preview"
            >
              {selectedImage?.type.startsWith("video/") ? (
                <video
                  src={previewUrl}
                  controls
                  playsInline
                  preload="metadata"
                />
              ) : (
                <img src={previewUrl} alt="Previzualizarea fotografiei" />
              )}

              <button
                type="button"
                onClick={onRemoveImage}
                aria-label="Elimină fișierul media"
                title="Elimină fișierul media"
              >
                <X size={18} />
              </button>

              <span>{selectedImage?.name}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -6 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -6 }}
              className="aurora-composer-c21-footer"
            >
              <div className="aurora-composer-c21-actions">
                {actions.map(({ label, icon: Icon, media }) => (
                  <motion.button
                    key={label}
                    type="button"
                    whileHover={{ y: -2, scale: 1.025 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={
                      media
                        ? () => imageInputRef.current?.click()
                        : undefined
                    }
                    title={
                      media ? label : `${label} — disponibil în curând`
                    }
                  >
                    <Icon size={17} />
                    <span>{label}</span>
                  </motion.button>
                ))}
              </div>

              <div className="aurora-composer-c22-publish-zone">
                <label className="aurora-composer-c22-native-audience">
                  <span className="aurora-composer-c22-native-icon">
                    {audienceIcon()}
                  </span>

                  <select
                    value={audienceValue}
                    onChange={(event) =>
                      handleAudienceChange(event.target.value)
                    }
                    onFocus={() => setFocused(true)}
                    aria-label="Alege cine poate vedea postarea"
                    title="Alege cine poate vedea postarea"
                  >
                    <option value="friends">Toți prietenii</option>

                    {groups.map((group) => (
                      <option key={group.id} value={`group:${group.id}`}>
                        {group.name}
                      </option>
                    ))}

                    <option value="private">Doar eu</option>
                  </select>
                </label>

                <motion.button
                  type="submit"
                  disabled={!canPublish}
                  whileHover={canPublish ? { y: -2, scale: 1.02 } : undefined}
                  whileTap={canPublish ? { scale: 0.97 } : undefined}
                  className="aurora-composer-c21-publish"
                >
                  {publishing ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : (
                    <Send size={17} />
                  )}
                  <span>{publishing ? "Se publică..." : "Publică"}</span>
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <input
          type="hidden"
          name="audience_type"
          value={
            audience.type === "all"
              ? "friends"
              : audience.type === "private"
                ? "private"
                : "group"
          }
        />

        <input
          type="hidden"
          name="audience_group_id"
          value={audience.type === "group" ? audience.groupId : ""}
        />

        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,video/x-m4v"
          onChange={onImageSelect}
          className="hidden"
        />
      </div>
    </motion.form>
  );
}
