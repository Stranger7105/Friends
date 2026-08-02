"use client";

import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  LoaderCircle,
  MessageCircle,
  Pause,
  Play,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import ReelComments from "@/components/reels/ReelComments";
import HoverVideo from "@/components/media/HoverVideo";
import VisibilityVideo from "@/components/media/VisibilityVideo";

type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type ReelRow = {
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  visibility: "public" | "friends" | "private";
  created_at: string;
  comments_count: number;
};

type ReelLikeRow = {
  reel_id: string;
  user_id: string;
};

type FeedReel = ReelRow & {
  profile: Profile | null;
  likes_count: number;
  liked_by_me: boolean;
};

type FeedReelsStripProps = {
  currentUserId: string;
};

function displayName(profile: Profile | null) {
  return profile?.full_name?.trim() || profile?.username?.trim() || "Membru Friends";
}

function initials(profile: Profile | null) {
  return displayName(profile)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function FeedReelsStrip({
  currentUserId,
}: FeedReelsStripProps) {
  const [reels, setReels] = useState<FeedReel[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [commentsReelId, setCommentsReelId] = useState<string | null>(null);
  const [likingReelId, setLikingReelId] = useState<string | null>(null);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const viewerVideoRef = useRef<HTMLVideoElement | null>(null);

  const activeReel =
    viewerIndex !== null ? reels[viewerIndex] ?? null : null;

  const loadReels = useCallback(async () => {
    if (!currentUserId) return;

    setLoading(true);
    setErrorMessage("");

    const { data: reelRows, error: reelsError } = await supabase
      .from("reels")
      .select(
        "id,user_id,video_url,thumbnail_url,caption,visibility,created_at,comments_count"
      )
      .neq("visibility", "private")
      .order("created_at", { ascending: false })
      .limit(12);

    if (reelsError) {
      console.error("Feed Reels error:", reelsError);
      setErrorMessage("Reels nu au putut fi încărcate.");
      setLoading(false);
      return;
    }

    const rows = (reelRows ?? []) as ReelRow[];
    const userIds = [...new Set(rows.map((reel) => reel.user_id))];

    let profiles = new Map<string, Profile>();

    if (userIds.length > 0) {
      const { data: profileRows, error: profilesError } = await supabase
        .from("profiles")
        .select("id,full_name,username,avatar_url")
        .in("id", userIds);

      if (profilesError) {
        console.warn("Feed Reels profiles warning:", profilesError);
      } else {
        profiles = new Map(
          ((profileRows ?? []) as Profile[]).map((profile) => [
            profile.id,
            profile,
          ])
        );
      }
    }

    const reelIds = rows.map((reel) => reel.id);
    let likes: ReelLikeRow[] = [];

    if (reelIds.length > 0) {
      const { data: likeRows, error: likesError } = await supabase
        .from("reel_likes")
        .select("reel_id,user_id")
        .in("reel_id", reelIds);

      if (likesError) {
        console.warn("Feed Reels likes warning:", likesError);
      } else {
        likes = (likeRows ?? []) as ReelLikeRow[];
      }
    }

    const likesByReelId = new Map<string, ReelLikeRow[]>();

    for (const like of likes) {
      const current = likesByReelId.get(like.reel_id) ?? [];
      current.push(like);
      likesByReelId.set(like.reel_id, current);
    }

    setReels(
      rows.map((reel) => {
        const reelLikes = likesByReelId.get(reel.id) ?? [];

        return {
          ...reel,
          profile: profiles.get(reel.user_id) ?? null,
          likes_count: reelLikes.length,
          liked_by_me: reelLikes.some(
            (like) => like.user_id === currentUserId
          ),
        };
      })
    );
    setLoading(false);
  }, [currentUserId]);

  useEffect(() => {
    void loadReels();
  }, [loadReels]);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`feed-reels-${currentUserId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reels",
        },
        () => void loadReels()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reel_likes",
        },
        () => void loadReels()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, loadReels]);

  useEffect(() => {
    if (viewerIndex === null) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeViewer();
      if (event.key === "ArrowRight") showNext();
      if (event.key === "ArrowLeft") showPrevious();
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [viewerIndex, reels.length]);

  useEffect(() => {
    const video = viewerVideoRef.current;
    if (!video || !activeReel) return;

    video.muted = muted;

    if (playing) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [activeReel, muted, playing]);

  const hasReels = useMemo(() => reels.length > 0, [reels.length]);

  function scrollTrack(direction: "left" | "right") {
    trackRef.current?.scrollBy({
      left: direction === "left" ? -430 : 430,
      behavior: "smooth",
    });
  }

  function openViewer(index: number) {
    setViewerIndex(index);
    setPlaying(true);
  }

  function closeViewer() {
    setViewerIndex(null);
    setPlaying(true);
  }

  function showPrevious() {
    if (reels.length === 0) return;

    setViewerIndex((current) => {
      if (current === null) return 0;
      return current === 0 ? reels.length - 1 : current - 1;
    });
    setPlaying(true);
  }

  function showNext() {
    if (reels.length === 0) return;

    setViewerIndex((current) => {
      if (current === null) return 0;
      return current === reels.length - 1 ? 0 : current + 1;
    });
    setPlaying(true);
  }

  async function toggleLike(reel: FeedReel) {
    if (!currentUserId || likingReelId !== null) return;

    const nextLiked = !reel.liked_by_me;

    setLikingReelId(reel.id);
    setErrorMessage("");

    setReels((current) =>
      current.map((item) =>
        item.id === reel.id
          ? {
              ...item,
              liked_by_me: nextLiked,
              likes_count: Math.max(
                0,
                item.likes_count + (nextLiked ? 1 : -1)
              ),
            }
          : item
      )
    );

    const result = nextLiked
      ? await supabase.from("reel_likes").upsert(
          {
            reel_id: reel.id,
            user_id: currentUserId,
          },
          { onConflict: "reel_id,user_id" }
        )
      : await supabase
          .from("reel_likes")
          .delete()
          .eq("reel_id", reel.id)
          .eq("user_id", currentUserId);

    if (result.error) {
      console.error("Reel like error:", result.error);
      setErrorMessage(`Like-ul nu a putut fi salvat: ${result.error.message}`);

      setReels((current) =>
        current.map((item) =>
          item.id === reel.id
            ? {
                ...item,
                liked_by_me: reel.liked_by_me,
                likes_count: reel.likes_count,
              }
            : item
        )
      );
    }

    setLikingReelId(null);
  }

  if (loading) {
    return (
      <section className="feed-reels-strip feed-reels-loading">
        <LoaderCircle className="feed-reels-spinner" />
        <span>Se încarcă Reels...</span>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="feed-reels-strip feed-reels-error">
        <span>{errorMessage}</span>
        <button type="button" onClick={() => void loadReels()}>
          Încearcă din nou
        </button>
      </section>
    );
  }

  if (!hasReels) return null;

  return (
    <>
      <section className="feed-reels-strip">
        <header className="feed-reels-header">
          <div>
            <span className="feed-reels-kicker">REELS ÎN FRIENDS</span>
            <h2>Momente video</h2>
          </div>

          <div className="feed-reels-header-actions">
            <Link href="/reels">Vezi toate</Link>

            <button
              type="button"
              onClick={() => scrollTrack("left")}
              aria-label="Derulează spre stânga"
            >
              <ChevronLeft />
            </button>

            <button
              type="button"
              onClick={() => scrollTrack("right")}
              aria-label="Derulează spre dreapta"
            >
              <ChevronRight />
            </button>
          </div>
        </header>

        <div ref={trackRef} className="feed-reels-track">
          {reels.map((reel, index) => (
            <motion.div
              key={reel.id}
              className="feed-reel-card-shell"
              whileHover={{ y: -7, scale: 1.11, zIndex: 30 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 360, damping: 24 }}
            >
              <button
                type="button"
                className="feed-reel-card"
                onClick={() => openViewer(index)}
              >
              {reel.thumbnail_url ? (
                <img
                  src={reel.thumbnail_url}
                  alt=""
                  className="feed-reel-cover"
                  loading="lazy"
                />
              ) : (
                <video
                  src={reel.video_url}
                  muted
                  playsInline
                  preload="metadata"
                  className="feed-reel-cover"
                />
              )}

              <HoverVideo
                src={reel.video_url}
                poster={reel.thumbnail_url}
                className="feed-reel-cover"
              />

              <VisibilityVideo
                src={reel.video_url}
                poster={reel.thumbnail_url}
                className="feed-reel-cover"
              />

              <span className="feed-reel-overlay" aria-hidden="true" />

              <span className="feed-reel-play">
                <Play fill="currentColor" />
              </span>

              <span className="feed-reel-author">
                <span className="feed-reel-avatar">
                  {reel.profile?.avatar_url ? (
                    <img
                      src={reel.profile.avatar_url}
                      alt=""
                    />
                  ) : (
                    initials(reel.profile)
                  )}
                </span>

                <span>
                  <strong>{displayName(reel.profile)}</strong>
                  <small>Reel nou</small>
                </span>
              </span>

              {reel.caption && (
                <span className="feed-reel-caption">{reel.caption}</span>
              )}
              </button>

              <div className="feed-reel-card-stats">
                <button
                  type="button"
                  className={`feed-reel-card-like ${
                    reel.liked_by_me ? "is-liked" : ""
                  }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    void toggleLike(reel);
                  }}
                  disabled={likingReelId === reel.id}
                  aria-label={
                    reel.liked_by_me
                      ? "Elimină aprecierea"
                      : "Apreciază Reel-ul"
                  }
                >
                  <Heart
                    size={13}
                    fill={reel.liked_by_me ? "currentColor" : "none"}
                  />
                  <span>{reel.likes_count}</span>
                </button>

                <button
                  type="button"
                  className="feed-reel-card-comments"
                  onClick={(event) => {
                    event.stopPropagation();
                    setCommentsReelId(reel.id);
                  }}
                  aria-label="Deschide comentariile"
                >
                  <MessageCircle size={13} />
                  <span>{reel.comments_count}</span>
                </button>
              </div>
            </motion.div>
          ))}

          <Link href="/reels" className="feed-reel-see-all">
            <span>＋</span>
            <strong>Vezi toate</strong>
            <small>Deschide Reels</small>
          </Link>
        </div>
      </section>

      <AnimatePresence>
        {activeReel && viewerIndex !== null && (
          <motion.div
            className="feed-reel-viewer"
            role="dialog"
            aria-modal="true"
            aria-label="Vizualizare Reel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeViewer();
            }}
          >
            <motion.div
              className="feed-reel-viewer-card"
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.96 }}
            >
              <video
                key={activeReel.id}
                ref={viewerVideoRef}
                src={activeReel.video_url}
                poster={activeReel.thumbnail_url ?? undefined}
                muted={muted}
                autoPlay
                loop
                playsInline
                className="feed-reel-viewer-video"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onClick={() => setPlaying((current) => !current)}
              />

              <div className="feed-reel-viewer-shade" aria-hidden="true" />

              <button
                type="button"
                className="feed-reel-viewer-close"
                onClick={closeViewer}
                aria-label="Închide Reel"
              >
                <X />
              </button>

              <button
                type="button"
                className="feed-reel-viewer-sound"
                onClick={() => setMuted((current) => !current)}
                aria-label={muted ? "Pornește sunetul" : "Oprește sunetul"}
              >
                {muted ? <VolumeX /> : <Volume2 />}
              </button>

              <button
                type="button"
                className="feed-reel-viewer-play"
                onClick={() => setPlaying((current) => !current)}
                aria-label={playing ? "Pauză" : "Redare"}
              >
                {playing ? <Pause /> : <Play fill="currentColor" />}
              </button>

              <button
                type="button"
                className="feed-reel-viewer-prev"
                onClick={showPrevious}
                aria-label="Reel anterior"
              >
                <ChevronLeft />
              </button>

              <button
                type="button"
                className="feed-reel-viewer-next"
                onClick={showNext}
                aria-label="Reel următor"
              >
                <ChevronRight />
              </button>

              <div className="feed-reel-viewer-info">
                <div className="feed-reel-viewer-author">
                  <span className="feed-reel-avatar feed-reel-viewer-avatar">
                    {activeReel.profile?.avatar_url ? (
                      <img
                        src={activeReel.profile.avatar_url}
                        alt=""
                      />
                    ) : (
                      initials(activeReel.profile)
                    )}
                  </span>

                  <div>
                    <strong>{displayName(activeReel.profile)}</strong>
                    <small>Friends Reel</small>
                  </div>
                </div>

                {activeReel.caption && <p>{activeReel.caption}</p>}

                <div className="feed-reel-viewer-social">
                  <button
                    type="button"
                    className={`feed-reel-viewer-like ${
                      activeReel.liked_by_me ? "is-liked" : ""
                    }`}
                    onClick={() => void toggleLike(activeReel)}
                    disabled={likingReelId === activeReel.id}
                  >
                    <Heart
                      size={17}
                      fill={
                        activeReel.liked_by_me ? "currentColor" : "none"
                      }
                    />
                    <span>
                      {activeReel.likes_count}{" "}
                      {activeReel.likes_count === 1
                        ? "apreciere"
                        : "aprecieri"}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="feed-reel-viewer-comments"
                    onClick={() => setCommentsReelId(activeReel.id)}
                  >
                    <MessageCircle size={17} />
                    <span>Comentarii ({activeReel.comments_count})</span>
                  </button>
                </div>

                <Link href="/reels">Deschide pagina Reels →</Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ReelComments
        open={commentsReelId !== null}
        reelId={commentsReelId}
        currentUserId={currentUserId}
        onClose={() => setCommentsReelId(null)}
        onCountChange={(reelId, count) => {
          setReels((current) =>
            current.map((item) =>
              item.id === reelId ? { ...item, comments_count: count } : item
            )
          );
        }}
      />
    </>
  );
}