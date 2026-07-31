"use client";

import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
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

type FeedReel = ReelRow & {
  profile: Profile | null;
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

    setReels(
      rows.map((reel) => ({
        ...reel,
        profile: profiles.get(reel.user_id) ?? null,
      }))
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
            <motion.button
              key={reel.id}
              type="button"
              className="feed-reel-card"
              onClick={() => openViewer(index)}
              whileHover={{ y: -5, scale: 1.018 }}
              whileTap={{ scale: 0.98 }}
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
            </motion.button>
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

                <button
                  type="button"
                  onClick={() => setCommentsReelId(activeReel.id)}
                  style={{
                    marginTop: 10,
                    border: "1px solid rgba(190,242,100,.2)",
                    borderRadius: 10,
                    background: "rgba(132,204,22,.08)",
                    padding: "8px 10px",
                    color: "#bef264",
                    fontSize: 10,
                    fontWeight: 900,
                  }}
                >
                  Comentarii ({activeReel.comments_count})
                </button>

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