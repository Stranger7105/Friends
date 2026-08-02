"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import StoryProgress from "./StoryProgress";
import { supabase } from "@/lib/supabase";
import type { AuroraStory } from "./stories";

type StoryViewerProps = {
  stories: AuroraStory[];
  initialIndex: number;
  onClose: () => void;
};

type StoryComment = {
  id: number;
  story_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

type CommentProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

const STORY_DURATION = 6000;
const STORY_REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "🔥"] as const;

function formatStoryTime(value: string) {
  const minutes = Math.max(
    1,
    Math.floor((Date.now() - new Date(value).getTime()) / 60000)
  );
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} ${hours === 1 ? "oră" : "ore"}`;
}

export default function StoryViewer({
  stories,
  initialIndex,
  onClose,
}: StoryViewerProps) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [selectedReaction, setSelectedReaction] = useState("");
  const [reactionMessage, setReactionMessage] = useState("");
  const [savingReaction, setSavingReaction] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<StoryComment[]>([]);
  const [commentProfiles, setCommentProfiles] = useState<
    Record<string, CommentProfile>
  >({});
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);
  const [commentError, setCommentError] = useState("");
  const frameRef = useRef<number | null>(null);
  const startedAtRef = useRef(performance.now());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const commentInputRef = useRef<HTMLInputElement | null>(null);

  const goNext = useCallback(() => {
    if (activeIndex >= stories.length - 1) {
      onClose();
      return;
    }
    setActiveIndex((current) => current + 1);
    setProgress(0);
    startedAtRef.current = performance.now();
  }, [activeIndex, onClose, stories.length]);

  const goPrevious = useCallback(() => {
    if (activeIndex <= 0) return;
    setActiveIndex((current) => current - 1);
    setProgress(0);
    startedAtRef.current = performance.now();
  }, [activeIndex]);

  useEffect(() => {
    let active = true;

    async function loadCurrentUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (active) {
        setCurrentUserId(user?.id || "");
      }
    }

    void loadCurrentUser();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setActiveIndex(initialIndex);
    setProgress(0);
    startedAtRef.current = performance.now();
  }, [initialIndex]);

  useEffect(() => {
    if (showComments) {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      return;
    }

    startedAtRef.current =
      performance.now() - (progress / 100) * STORY_DURATION;

    function tick(now: number) {
      const elapsed = now - startedAtRef.current;
      const nextProgress = Math.min(100, (elapsed / STORY_DURATION) * 100);

      setProgress(nextProgress);

      if (nextProgress >= 100) {
        goNext();
        return;
      }

      frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [activeIndex, goNext, showComments]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") goNext();
      if (event.key === "ArrowLeft") goPrevious();
    }

    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [goNext, goPrevious, onClose]);

  const story = stories[activeIndex];

  useEffect(() => {
    if (!story?.id || !currentUserId) {
      setSelectedReaction("");
      return;
    }

    let active = true;

    async function loadReaction() {
      const { data, error } = await supabase
        .from("story_reactions")
        .select("emoji")
        .eq("story_id", String(story.id))
        .eq("user_id", currentUserId)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.error("Reacția la Story nu a putut fi încărcată:", error.message);
        return;
      }

      setSelectedReaction(data?.emoji || "");
    }

    void loadReaction();

    return () => {
      active = false;
    };
  }, [currentUserId, story?.id]);

  useEffect(() => {
    if (!story?.id || !showComments) return;

    let active = true;
    setLoadingComments(true);
    setCommentError("");

    async function loadComments() {
      const { data, error } = await supabase
        .from("story_comments")
        .select("id, story_id, user_id, content, created_at")
        .eq("story_id", String(story.id))
        .order("created_at", { ascending: true });

      if (!active) return;

      if (error) {
        setCommentError(`Comentariile nu au putut fi încărcate: ${error.message}`);
        setLoadingComments(false);
        return;
      }

      const loadedComments = (data || []) as StoryComment[];
      setComments(loadedComments);

      const profileIds = Array.from(
        new Set(loadedComments.map((comment) => comment.user_id)),
      );

      if (profileIds.length > 0) {
        const profilesResult = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", profileIds);

        if (!profilesResult.error && active) {
          const profileMap = Object.fromEntries(
            ((profilesResult.data || []) as CommentProfile[]).map((profile) => [
              profile.id,
              profile,
            ]),
          );
          setCommentProfiles((current) => ({ ...current, ...profileMap }));
        }
      }

      setLoadingComments(false);
    }

    void loadComments();

    const channel = supabase
      .channel(`story-comments-${String(story.id)}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "story_comments",
          filter: `story_id=eq.${String(story.id)}`,
        },
        async (payload) => {
          const newComment = payload.new as StoryComment;

          setComments((current) =>
            current.some((comment) => comment.id === newComment.id)
              ? current
              : [...current, newComment],
          );

          if (!commentProfiles[newComment.user_id]) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("id, username, full_name, avatar_url")
              .eq("id", newComment.user_id)
              .maybeSingle();

            if (profile) {
              setCommentProfiles((current) => ({
                ...current,
                [profile.id]: profile as CommentProfile,
              }));
            }
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "story_comments",
          filter: `story_id=eq.${String(story.id)}`,
        },
        (payload) => {
          const deleted = payload.old as Partial<StoryComment>;
          setComments((current) =>
            current.filter((comment) => comment.id !== deleted.id),
          );
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [showComments, story?.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !story?.audioUrl) {
      setAudioBlocked(false);
      return;
    }

    audio.currentTime = Math.max(0, story.audioStart || 0);
    audio.volume = Math.max(0, Math.min(1, story.audioVolume ?? 0.7));
    audio.muted = musicMuted;

    const playPromise = audio.play();
    if (playPromise) {
      playPromise
        .then(() => setAudioBlocked(false))
        .catch(() => setAudioBlocked(true));
    }

    return () => {
      audio.pause();
    };
  }, [activeIndex, musicMuted, story]);

  if (!story) return null;

  async function enableAudio() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = false;
    setMusicMuted(false);
    try {
      await audio.play();
      setAudioBlocked(false);
    } catch {
      setAudioBlocked(true);
    }
  }

  async function sendReaction(emoji: string) {
    if (!story?.id || !currentUserId || savingReaction) return;

    setSavingReaction(true);
    setReactionMessage("");
    startedAtRef.current = performance.now();
    setProgress(0);

    if (selectedReaction === emoji) {
      const { error } = await supabase
        .from("story_reactions")
        .delete()
        .eq("story_id", String(story.id))
        .eq("user_id", currentUserId);

      if (error) {
        setReactionMessage(`Reacția nu a putut fi eliminată: ${error.message}`);
      } else {
        setSelectedReaction("");
        setReactionMessage("Reacția a fost eliminată.");
      }

      setSavingReaction(false);
      return;
    }

    const { error } = await supabase.from("story_reactions").upsert(
      {
        story_id: String(story.id),
        user_id: currentUserId,
        owner_id: story.userId,
        emoji,
      },
      {
        onConflict: "story_id,user_id",
      },
    );

    if (error) {
      setReactionMessage(`Reacția nu a putut fi trimisă: ${error.message}`);
    } else {
      setSelectedReaction(emoji);
      setReactionMessage(`${emoji} Reacția a fost trimisă.`);
    }

    setSavingReaction(false);
  }

  async function sendStoryComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = commentText.trim();

    if (!content || !story?.id || !currentUserId || sendingComment) return;

    setSendingComment(true);
    setCommentError("");

    const { data, error } = await supabase
      .from("story_comments")
      .insert({
        story_id: String(story.id),
        user_id: currentUserId,
        owner_id: story.userId,
        content,
      })
      .select("id, story_id, user_id, content, created_at")
      .single();

    if (error) {
      setCommentError(`Comentariul nu a putut fi trimis: ${error.message}`);
      setSendingComment(false);
      return;
    }

    const savedComment = data as StoryComment;

    setComments((current) =>
      current.some((comment) => comment.id === savedComment.id)
        ? current
        : [...current, savedComment],
    );
    setCommentText("");
    setSendingComment(false);

    requestAnimationFrame(() => commentInputRef.current?.focus());
  }

  async function deleteStoryComment(comment: StoryComment) {
    if (comment.user_id !== currentUserId) return;

    const { error } = await supabase
      .from("story_comments")
      .delete()
      .eq("id", comment.id)
      .eq("user_id", currentUserId);

    if (error) {
      setCommentError(`Comentariul nu a putut fi șters: ${error.message}`);
      return;
    }

    setComments((current) =>
      current.filter((item) => item.id !== comment.id),
    );
  }

  return (
    <div
      className="aurora-story-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={`Poveste de la ${story.name}`}
    >
      <button
        type="button"
        className="aurora-story-viewer-backdrop"
        onClick={onClose}
        aria-label="Închide povestea"
      />

      <section className="aurora-story-viewer-panel aurora-story-viewer-panel-v4">
        <StoryProgress
          count={stories.length}
          activeIndex={activeIndex}
          progress={progress}
        />

        <header className="aurora-story-viewer-header">
          <div className="aurora-story-viewer-user">
            <span className="aurora-story-viewer-avatar">
              {story.name.charAt(0).toUpperCase()}
            </span>
            <div>
              <strong>{story.name}</strong>
              <span>
                @{story.username} · {formatStoryTime(story.createdAt)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {story.audioUrl && (
              <button
                type="button"
                className="aurora-story-close"
                onClick={() => setMusicMuted((current) => !current)}
                aria-label={musicMuted ? "Pornește melodia" : "Oprește melodia"}
                title={musicMuted ? "Pornește melodia" : "Oprește melodia"}
              >
                {musicMuted ? "🔇" : "🔊"}
              </button>
            )}
            <button
              type="button"
              className="aurora-story-close"
              onClick={onClose}
              aria-label="Închide"
            >
              ×
            </button>
          </div>
        </header>

        <div className="aurora-story-media relative overflow-hidden">
          {story.mediaType === "video" ? (
            <video
              src={story.mediaUrl}
              autoPlay
              muted={Boolean(story.audioUrl)}
              playsInline
            />
          ) : (
            <img src={story.mediaUrl} alt={story.caption || "Poveste"} />
          )}

            {story.effectType !== "none" && (
          <div
            className={`pointer-events-none absolute inset-0 z-10 overflow-hidden ${
              story.effectType === "glow" ? "aurora-effect-glow" : ""
            }`}
            style={{ opacity: story.effectIntensity }}
            aria-hidden="true"
          >
            {story.effectType === "aurora" && (
              <>
                <span className="aurora-effect-wave aurora-effect-wave-one" />
                <span className="aurora-effect-wave aurora-effect-wave-two" />
                <span className="aurora-effect-wave aurora-effect-wave-three" />
              </>
            )}

            {story.effectType === "stars" &&
              Array.from({ length: 42 }).map((_, index) => (
                <span
                  key={`viewer-star-${index}`}
                  className="aurora-effect-star"
                  style={{
                    left: `${(index * 37) % 100}%`,
                    top: `${(index * 53) % 100}%`,
                    animationDelay: `${(index % 9) * 0.22}s`,
                    animationDuration: `${2.2 + (index % 5) * 0.55}s`,
                  }}
                />
              ))}

            {story.effectType === "snow" &&
              Array.from({ length: 34 }).map((_, index) => (
                <span
                  key={`viewer-snow-${index}`}
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

            {story.effectType === "rain" &&
              Array.from({ length: 40 }).map((_, index) => (
                <span
                  key={`viewer-rain-${index}`}
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


          {story.audioUrl && (
            <>
              <audio ref={audioRef} src={story.audioUrl} preload="auto" />
              <div className="absolute bottom-4 left-1/2 z-20 max-w-[82%] -translate-x-1/2 rounded-2xl border border-white/15 bg-slate-950/75 px-4 py-2 text-center text-white shadow-xl backdrop-blur">
                <p className="truncate text-sm font-black">
                  🎵 {story.audioTitle || "Melodie"}
                </p>
                <p className="text-[11px] text-white/55">Aurora Music</p>
              </div>
            </>
          )}

          {audioBlocked && story.audioUrl && (
            <button
              type="button"
              onClick={enableAudio}
              className="absolute inset-x-6 top-1/2 z-30 -translate-y-1/2 rounded-2xl border border-violet-300/30 bg-slate-950/90 px-5 py-4 font-black text-white shadow-2xl backdrop-blur"
            >
              ▶ Apasă pentru a porni melodia
            </button>
          )}

          <div className="aurora-story-media-glow" aria-hidden="true" />
        </div>

        {story.caption && (
          <p className="aurora-story-caption">{story.caption}</p>
        )}

        <button
          type="button"
          className="aurora-story-nav aurora-story-nav-previous"
          onClick={goPrevious}
          disabled={activeIndex === 0}
          aria-label="Povestea precedentă"
        >
          ‹
        </button>

        <button
          type="button"
          className="aurora-story-nav aurora-story-nav-next"
          onClick={goNext}
          aria-label="Povestea următoare"
        >
          ›
        </button>
      </section>

      <div
        className="aurora-story-reaction-dock-fixed"
        aria-label="Reacții la poveste"
      >
        <div className="aurora-story-reaction-dock-row">
          {STORY_REACTIONS.map((emoji) => {
            const active = selectedReaction === emoji;

            return (
              <span
                key={emoji}
                role="button"
                tabIndex={0}
                className={`aurora-story-reaction-chip-fixed ${
                  active ? "is-active" : ""
                }`}
                aria-label={`Reacționează cu ${emoji}`}
                aria-pressed={active}
                onClick={() => void sendReaction(emoji)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    void sendReaction(emoji);
                  }
                }}
              >
                {emoji}
              </span>
            );
          })}

          <span
            role="button"
            tabIndex={0}
            className="aurora-story-comment-open-fixed"
            aria-label="Deschide comentariile"
            aria-expanded={showComments}
            onClick={() => {
              setShowComments(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setShowComments(true);
              }
            }}
          >
            💬
            {comments.length > 0 && (
              <small>{comments.length > 99 ? "99+" : comments.length}</small>
            )}
          </span>
        </div>

        <p className="aurora-story-reaction-dock-status">
          {reactionMessage || "Alege o reacție pentru această poveste."}
        </p>
      </div>


      {showComments && (
        <div
          className="aurora-story-comments-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Comentarii la poveste"
        >
          <button
            type="button"
            className="aurora-story-comments-backdrop"
            onClick={() => setShowComments(false)}
            aria-label="Închide comentariile"
          />

          <section className="aurora-story-comments-sheet">
            <header className="aurora-story-comments-header">
              <div>
                <strong>Comentarii</strong>
                <span>
                  {comments.length}{" "}
                  {comments.length === 1 ? "comentariu" : "comentarii"}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowComments(false)}
                aria-label="Închide comentariile"
              >
                ×
              </button>
            </header>

            <div className="aurora-story-comments-list">
              {loadingComments && (
                <p className="aurora-story-comments-empty">
                  Se încarcă comentariile...
                </p>
              )}

              {!loadingComments && comments.length === 0 && (
                <p className="aurora-story-comments-empty">
                  Nu există comentarii încă. Scrie primul comentariu.
                </p>
              )}

              {comments.map((comment) => {
                const profile = commentProfiles[comment.user_id];
                const name =
                  profile?.full_name ||
                  profile?.username ||
                  "Utilizator Friends";

                return (
                  <article
                    key={comment.id}
                    className="aurora-story-comment-item"
                  >
                    <div className="aurora-story-comment-avatar">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="" />
                      ) : (
                        name.charAt(0).toUpperCase()
                      )}
                    </div>

                    <div className="aurora-story-comment-body">
                      <div className="aurora-story-comment-meta">
                        <strong>{name}</strong>
                        <time>
                          {new Date(comment.created_at).toLocaleTimeString(
                            "ro-RO",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </time>
                      </div>

                      <p>{comment.content}</p>
                    </div>

                    {comment.user_id === currentUserId && (
                      <button
                        type="button"
                        className="aurora-story-comment-delete"
                        onClick={() => void deleteStoryComment(comment)}
                        aria-label="Șterge comentariul"
                        title="Șterge comentariul"
                      >
                        ×
                      </button>
                    )}
                  </article>
                );
              })}
            </div>

            {commentError && (
              <p className="aurora-story-comments-error">{commentError}</p>
            )}

            <form
              className="aurora-story-comment-composer"
              onSubmit={sendStoryComment}
            >
              <input
                ref={commentInputRef}
                type="text"
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                placeholder="Scrie un comentariu..."
                maxLength={500}
                autoComplete="off"
                inputMode="text"
              />

              <button
                type="submit"
                disabled={
                  sendingComment ||
                  !commentText.trim() ||
                  !currentUserId
                }
              >
                {sendingComment ? "…" : "➤"}
              </button>
            </form>
          </section>
        </div>
      )}

      <style jsx>{`
        .aurora-effect-wave {
          position: absolute;
          width: 150%;
          height: 42%;
          left: -25%;
          border-radius: 50%;
          filter: blur(28px);
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

        .aurora-story-viewer-panel-v4 {
          position: relative;
          display: flex;
          flex-direction: column;
          width: min(94vw, 520px);
          height: min(92dvh, 860px);
          max-height: 92dvh;
          overflow: hidden;
        }

        .aurora-story-reactions-top {
          position: relative;
          z-index: 100;
          flex: 0 0 auto;
          display: block;
          width: 100%;
          padding: 8px 10px;
          color: #fff;
          background: #020617;
          border-top: 1px solid rgba(255,255,255,.08);
          border-bottom: 1px solid rgba(255,255,255,.12);
          box-sizing: border-box;
        }

        .aurora-story-reaction-bar-top {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: 100%;
          min-height: 46px;
        }

        .aurora-story-reaction-button-top {
          display: grid !important;
          place-items: center !important;
          flex: 0 0 44px;
          width: 44px !important;
          min-width: 44px !important;
          height: 44px !important;
          min-height: 44px !important;
          margin: 0 !important;
          padding: 0 !important;
          color: #fff !important;
          font-size: 24px !important;
          line-height: 1 !important;
          border: 1px solid rgba(255,255,255,.16) !important;
          border-radius: 999px !important;
          background: rgba(255,255,255,.09) !important;
          opacity: 1 !important;
          visibility: visible !important;
          overflow: visible !important;
          pointer-events: auto !important;
          box-sizing: border-box !important;
        }

        .aurora-story-reaction-button-top span {
          display: block !important;
          color: initial !important;
          font-size: 24px !important;
          line-height: 1 !important;
          opacity: 1 !important;
          visibility: visible !important;
        }

        .aurora-story-reaction-button-top.is-active {
          border-color: #6ee7b7 !important;
          background: rgba(16,185,129,.32) !important;
          box-shadow: 0 0 0 3px rgba(16,185,129,.18) !important;
          transform: scale(1.08);
        }

        .aurora-story-reaction-button-top:disabled {
          opacity: .45 !important;
        }

        .aurora-story-reaction-status-top {
          min-height: 15px;
          margin-top: 3px;
        }

        .aurora-story-reaction-status-top p {
          margin: 0;
          color: rgba(255,255,255,.68);
          font-size: 10px;
          line-height: 1.3;
          text-align: center;
        }

        .aurora-story-viewer-panel-v4 .aurora-story-media {
          flex: 1 1 auto;
          min-height: 0;
          height: auto;
          overflow: hidden;
          background: #020617;
        }

        .aurora-story-viewer-panel-v4 .aurora-story-media img,
        .aurora-story-viewer-panel-v4 .aurora-story-media video {
          width: 100%;
          height: 100%;
          object-fit: contain;
          background: #020617;
        }

        .aurora-story-viewer-panel-v4 .aurora-story-caption {
          flex: 0 0 auto;
          margin: 0;
          padding: 8px 14px;
          color: rgba(255,255,255,.92);
          background: #020617;
        }

        .aurora-story-viewer-panel-v4 .aurora-story-nav {
          z-index: 110;
        }

        @media (max-width: 520px) {
          .aurora-story-viewer-panel-v4 {
            width: 100vw;
            height: 100dvh;
            max-height: 100dvh;
            border-radius: 0;
          }

          .aurora-story-reactions-top {
            padding: 6px 6px;
          }

          .aurora-story-reaction-bar-top {
            gap: 4px;
            min-height: 42px;
          }

          .aurora-story-reaction-button-top {
            flex-basis: 40px;
            width: 40px !important;
            min-width: 40px !important;
            height: 40px !important;
            min-height: 40px !important;
            font-size: 22px !important;
          }

          .aurora-story-reaction-button-top span {
            font-size: 22px !important;
          }
        }


        .aurora-story-reaction-dock-fixed {
          position: fixed !important;
          left: 50% !important;
          bottom: calc(82px + env(safe-area-inset-bottom)) !important;
          z-index: 2147483000 !important;
          display: block !important;
          width: min(94vw, 430px) !important;
          padding: 8px 10px 6px !important;
          transform: translateX(-50%) !important;
          color: #ffffff !important;
          background: rgba(2, 6, 23, 0.94) !important;
          border: 1px solid rgba(255, 255, 255, 0.2) !important;
          border-radius: 20px !important;
          box-shadow: 0 18px 50px rgba(0, 0, 0, 0.48) !important;
          backdrop-filter: blur(18px) !important;
          -webkit-backdrop-filter: blur(18px) !important;
          opacity: 1 !important;
          visibility: visible !important;
          pointer-events: auto !important;
          box-sizing: border-box !important;
        }

        .aurora-story-reaction-dock-row {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 5px !important;
          width: 100% !important;
          min-height: 44px !important;
          opacity: 1 !important;
          visibility: visible !important;
        }

        .aurora-story-reaction-chip-fixed {
          display: grid !important;
          place-items: center !important;
          flex: 1 1 0 !important;
          width: auto !important;
          min-width: 0 !important;
          height: 44px !important;
          min-height: 44px !important;
          margin: 0 !important;
          padding: 0 !important;
          color: #ffffff !important;
          font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif !important;
          font-size: 25px !important;
          line-height: 1 !important;
          text-indent: 0 !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          border-radius: 14px !important;
          background: rgba(255, 255, 255, 0.1) !important;
          opacity: 1 !important;
          visibility: visible !important;
          overflow: visible !important;
          pointer-events: auto !important;
          cursor: pointer !important;
          user-select: none !important;
          -webkit-user-select: none !important;
          box-sizing: border-box !important;
        }

        .aurora-story-reaction-chip-fixed.is-active {
          border-color: #6ee7b7 !important;
          background: rgba(16, 185, 129, 0.36) !important;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.18) !important;
          transform: translateY(-2px) scale(1.06) !important;
        }

        .aurora-story-reaction-dock-status {
          display: block !important;
          min-height: 14px !important;
          margin: 4px 0 0 !important;
          color: rgba(255, 255, 255, 0.72) !important;
          font-size: 10px !important;
          line-height: 1.3 !important;
          text-align: center !important;
          opacity: 1 !important;
          visibility: visible !important;
        }

        @media (min-width: 768px) {
          .aurora-story-reaction-dock-fixed {
            bottom: 24px !important;
          }
        }


        .aurora-story-comment-open-fixed {
          position: relative !important;
          display: grid !important;
          place-items: center !important;
          flex: 1 1 0 !important;
          min-width: 0 !important;
          height: 44px !important;
          color: #ffffff !important;
          font-size: 23px !important;
          border: 1px solid rgba(255,255,255,.15) !important;
          border-radius: 14px !important;
          background: rgba(255,255,255,.1) !important;
          cursor: pointer !important;
          user-select: none !important;
        }

        .aurora-story-comment-open-fixed small {
          position: absolute;
          top: -5px;
          right: -3px;
          display: grid;
          place-items: center;
          min-width: 18px;
          height: 18px;
          padding: 0 4px;
          color: white;
          font-size: 9px;
          font-weight: 900;
          border: 2px solid #020617;
          border-radius: 999px;
          background: #ef4444;
        }

        .aurora-story-comments-overlay {
          position: fixed !important;
          inset: 0 !important;
          z-index: 2147483500 !important;
          display: flex !important;
          align-items: flex-end !important;
          justify-content: center !important;
          pointer-events: auto !important;
        }

        .aurora-story-comments-backdrop {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          border: 0 !important;
          background: rgba(0,0,0,.58) !important;
          backdrop-filter: blur(4px) !important;
          -webkit-backdrop-filter: blur(4px) !important;
        }

        .aurora-story-comments-sheet {
          position: relative !important;
          z-index: 2 !important;
          display: flex !important;
          flex-direction: column !important;
          width: min(100%, 540px) !important;
          height: min(72dvh, 680px) !important;
          max-height: 72dvh !important;
          color: #e5eef9 !important;
          border: 1px solid rgba(255,255,255,.14) !important;
          border-bottom: 0 !important;
          border-radius: 24px 24px 0 0 !important;
          background: #071a18 !important;
          box-shadow: 0 -24px 70px rgba(0,0,0,.48) !important;
          overflow: hidden !important;
        }

        .aurora-story-comments-header {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          flex: 0 0 auto !important;
          min-height: 64px !important;
          padding: 10px 14px !important;
          border-bottom: 1px solid rgba(255,255,255,.11) !important;
          background: rgba(2, 20, 18, .96) !important;
        }

        .aurora-story-comments-header strong,
        .aurora-story-comments-header span {
          display: block !important;
        }

        .aurora-story-comments-header strong {
          font-size: 17px !important;
        }

        .aurora-story-comments-header span {
          margin-top: 2px !important;
          color: rgba(255,255,255,.56) !important;
          font-size: 11px !important;
        }

        .aurora-story-comments-header button {
          display: grid !important;
          place-items: center !important;
          width: 40px !important;
          height: 40px !important;
          color: white !important;
          font-size: 24px !important;
          border: 1px solid rgba(255,255,255,.14) !important;
          border-radius: 13px !important;
          background: rgba(255,255,255,.08) !important;
        }

        .aurora-story-comments-list {
          flex: 1 1 auto !important;
          min-height: 0 !important;
          padding: 12px !important;
          overflow-y: auto !important;
          -webkit-overflow-scrolling: touch !important;
        }

        .aurora-story-comments-empty {
          margin: 0 !important;
          padding: 30px 15px !important;
          color: rgba(255,255,255,.56) !important;
          text-align: center !important;
        }

        .aurora-story-comment-item {
          display: grid !important;
          grid-template-columns: 40px minmax(0, 1fr) 32px !important;
          align-items: start !important;
          gap: 9px !important;
          padding: 9px 0 !important;
          border-bottom: 1px solid rgba(255,255,255,.07) !important;
        }

        .aurora-story-comment-avatar {
          display: grid !important;
          place-items: center !important;
          width: 40px !important;
          height: 40px !important;
          overflow: hidden !important;
          color: white !important;
          font-weight: 900 !important;
          border-radius: 999px !important;
          background: #059669 !important;
        }

        .aurora-story-comment-avatar img {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }

        .aurora-story-comment-body {
          min-width: 0 !important;
          padding: 8px 10px !important;
          border-radius: 14px !important;
          background: rgba(255,255,255,.075) !important;
        }

        .aurora-story-comment-meta {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 8px !important;
        }

        .aurora-story-comment-meta strong {
          overflow: hidden !important;
          font-size: 12px !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }

        .aurora-story-comment-meta time {
          flex: 0 0 auto !important;
          color: rgba(255,255,255,.42) !important;
          font-size: 9px !important;
        }

        .aurora-story-comment-body p {
          margin: 4px 0 0 !important;
          color: rgba(255,255,255,.88) !important;
          font-size: 14px !important;
          line-height: 1.42 !important;
          overflow-wrap: anywhere !important;
        }

        .aurora-story-comment-delete {
          display: grid !important;
          place-items: center !important;
          width: 30px !important;
          height: 30px !important;
          color: rgba(255,255,255,.48) !important;
          border: 0 !important;
          border-radius: 10px !important;
          background: transparent !important;
        }

        .aurora-story-comments-error {
          flex: 0 0 auto !important;
          margin: 0 !important;
          padding: 8px 12px !important;
          color: #fecaca !important;
          font-size: 11px !important;
          background: rgba(127,29,29,.52) !important;
        }

        .aurora-story-comment-composer {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) 48px !important;
          gap: 8px !important;
          flex: 0 0 auto !important;
          padding:
            10px
            10px
            max(10px, env(safe-area-inset-bottom)) !important;
          border-top: 1px solid rgba(255,255,255,.12) !important;
          background: #021412 !important;
        }

        .aurora-story-comment-composer input {
          display: block !important;
          width: 100% !important;
          min-width: 0 !important;
          height: 48px !important;
          padding: 0 14px !important;
          color: #111827 !important;
          -webkit-text-fill-color: #111827 !important;
          caret-color: #059669 !important;
          font-size: 16px !important;
          border: 2px solid #94a3b8 !important;
          border-radius: 15px !important;
          outline: none !important;
          background: white !important;
          box-sizing: border-box !important;
        }

        .aurora-story-comment-composer button {
          display: grid !important;
          place-items: center !important;
          width: 48px !important;
          height: 48px !important;
          color: white !important;
          font-size: 21px !important;
          border: 0 !important;
          border-radius: 15px !important;
          background: #059669 !important;
        }

        .aurora-story-comment-composer button:disabled {
          opacity: .5 !important;
        }

        @media (max-width: 520px) {
          .aurora-story-comments-sheet {
            height: 76dvh !important;
            max-height: 76dvh !important;
            border-radius: 20px 20px 0 0 !important;
          }
        }


        /* STORY COMMENTS — composer vizibil deasupra barei mobile */
        .aurora-story-comments-overlay {
          padding-bottom:
            calc(
              var(--friends-mobile-bottom-height, 76px) +
              env(safe-area-inset-bottom)
            ) !important;
          box-sizing: border-box !important;
        }

        .aurora-story-comments-sheet {
          height: min(68dvh, 640px) !important;
          max-height:
            calc(
              100dvh -
              var(--friends-mobile-bottom-height, 76px) -
              env(safe-area-inset-bottom) -
              24px
            ) !important;
        }

        .aurora-story-comment-composer {
          position: sticky !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          z-index: 50 !important;
          flex: 0 0 auto !important;
          width: 100% !important;
          min-height:
            calc(68px + env(safe-area-inset-bottom)) !important;
          visibility: visible !important;
          opacity: 1 !important;
          pointer-events: auto !important;
        }

        .aurora-story-comment-composer input,
        .aurora-story-comment-composer button {
          visibility: visible !important;
          opacity: 1 !important;
          pointer-events: auto !important;
        }

        @media (max-width: 520px) {
          .aurora-story-comments-overlay {
            align-items: flex-end !important;
            padding-bottom:
              calc(76px + env(safe-area-inset-bottom)) !important;
          }

          .aurora-story-comments-sheet {
            height: calc(
              100dvh -
              150px -
              env(safe-area-inset-bottom)
            ) !important;
            max-height: calc(
              100dvh -
              150px -
              env(safe-area-inset-bottom)
            ) !important;
          }

          .aurora-story-comments-list {
            padding-bottom: 14px !important;
          }

          .aurora-story-comment-composer {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) 48px !important;
            gap: 8px !important;
            padding:
              10px
              10px
              max(10px, env(safe-area-inset-bottom)) !important;
            background: #021412 !important;
            border-top: 1px solid rgba(255,255,255,.14) !important;
          }
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