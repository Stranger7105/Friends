"use client";

import {
  Bookmark,
  Heart,
  LoaderCircle,
  MessageCircle,
  MoreHorizontal,
  Pause,
  Play,
  Share2,
  Upload,
  Volume2,
  VolumeX,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/lib/supabase";

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
  location: string | null;
  music_title: string | null;
  visibility: "public" | "friends" | "private";
  views_count: number;
  comments_count: number;
  likes_count: number;
  shares_count: number;
  created_at: string;
};

type ReelItem = ReelRow & {
  profile: Profile | null;
  likedByMe: boolean;
  savedByMe: boolean;
};

function formatCount(value: number) {
  return new Intl.NumberFormat("ro-RO", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function initials(profile: Profile | null) {
  const source =
    profile?.full_name?.trim() ||
    profile?.username?.trim() ||
    "F";

  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function authorName(profile: Profile | null) {
  return profile?.full_name?.trim() || profile?.username?.trim() || "Membru Friends";
}

function authorHandle(profile: Profile | null) {
  const handle =
    profile?.username?.trim() ||
    profile?.full_name?.trim().toLowerCase().replace(/\s+/g, ".") ||
    "friends";

  return `@${handle}`;
}

type ReelFeedProps = {
  refreshKey?: number;
};

export default function ReelFeed({ refreshKey = 0 }: ReelFeedProps) {
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [muted, setMuted] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const feedRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef(new Map<string, HTMLVideoElement>());
  const visibleReelRef = useRef<string | null>(null);

  const setBusy = useCallback((id: string, busy: boolean) => {
    setBusyIds((current) => {
      const next = new Set(current);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const loadReels = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      setLoadError("Sesiunea a expirat. Autentifică-te din nou.");
      return;
    }

    setCurrentUserId(user.id);

    const { data: reelRows, error: reelsError } = await supabase
      .from("reels")
      .select(
        "id,user_id,video_url,thumbnail_url,caption,location,music_title,visibility,views_count,comments_count,likes_count,shares_count,created_at"
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (reelsError) {
      console.error("Reels load error:", reelsError);
      setLoadError(
        "Reels nu au putut fi încărcate. Verifică dacă ai rulat SQL-ul pentru tabelul reels."
      );
      setLoading(false);
      return;
    }

    const rows = (reelRows ?? []) as ReelRow[];
    const userIds = [...new Set(rows.map((reel) => reel.user_id))];

    const [profilesResult, likesResult, savedResult] = await Promise.all([
      userIds.length
        ? supabase
            .from("profiles")
            .select("id,full_name,username,avatar_url")
            .in("id", userIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("reel_likes")
        .select("reel_id")
        .eq("user_id", user.id),
      supabase
        .from("saved_reels")
        .select("reel_id")
        .eq("user_id", user.id),
    ]);

    if (profilesResult.error) {
      console.warn("Profiles load warning:", profilesResult.error);
    }

    const profiles = new Map(
      ((profilesResult.data ?? []) as Profile[]).map((profile) => [
        profile.id,
        profile,
      ])
    );

    const likedIds = new Set(
      (likesResult.data ?? []).map((item: { reel_id: string }) => String(item.reel_id))
    );
    const savedIds = new Set(
      (savedResult.data ?? []).map((item: { reel_id: string }) => String(item.reel_id))
    );

    const prepared = rows.map<ReelItem>((reel) => ({
      ...reel,
      profile: profiles.get(reel.user_id) ?? null,
      likedByMe: likedIds.has(reel.id),
      savedByMe: savedIds.has(reel.id),
    }));

    setReels(prepared);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadReels();
  }, [loadReels, refreshKey]);

  useEffect(() => {
    const root = feedRef.current;
    if (!root || reels.length === 0) return;

    const cards = Array.from(
      root.querySelectorAll<HTMLElement>("[data-reel-id]")
    );

    const observer = new IntersectionObserver(
      (entries) => {
        const mostVisible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!mostVisible || mostVisible.intersectionRatio < 0.62) return;

        const id = (mostVisible.target as HTMLElement).dataset.reelId;
        if (!id || visibleReelRef.current === id) return;

        visibleReelRef.current = id;
        setPlayingId(id);

        videoRefs.current.forEach((video, videoId) => {
          if (videoId === id) {
            video.muted = muted;
            void video.play().catch(() => undefined);
          } else {
            video.pause();
          }
        });
      },
      {
        root,
        threshold: [0.25, 0.62, 0.85],
      }
    );

    cards.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, [muted, reels]);

  useEffect(() => {
    videoRefs.current.forEach((video) => {
      video.muted = muted;
    });
  }, [muted]);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`reels-feed-${currentUserId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reels" },
        () => void loadReels()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, loadReels]);

  const hasReels = useMemo(() => reels.length > 0, [reels.length]);

  function registerVideo(id: string, node: HTMLVideoElement | null) {
    if (node) videoRefs.current.set(id, node);
    else videoRefs.current.delete(id);
  }

  function togglePlayback(id: string) {
    const video = videoRefs.current.get(id);
    if (!video) return;

    if (video.paused) {
      videoRefs.current.forEach((other, otherId) => {
        if (otherId !== id) other.pause();
      });
      video.muted = muted;
      void video.play().catch(() => undefined);
      setPlayingId(id);
      visibleReelRef.current = id;
    } else {
      video.pause();
      setPlayingId(null);
    }
  }

  async function toggleLike(reel: ReelItem) {
    if (!currentUserId || busyIds.has(reel.id)) return;

    setBusy(reel.id, true);

    const optimisticLiked = !reel.likedByMe;

    setReels((current) =>
      current.map((item) =>
        item.id === reel.id
          ? {
              ...item,
              likedByMe: optimisticLiked,
              likes_count: Math.max(
                0,
                item.likes_count + (optimisticLiked ? 1 : -1)
              ),
            }
          : item
      )
    );

    const result = reel.likedByMe
      ? await supabase
          .from("reel_likes")
          .delete()
          .eq("reel_id", reel.id)
          .eq("user_id", currentUserId)
      : await supabase.from("reel_likes").insert({
          reel_id: reel.id,
          user_id: currentUserId,
        });

    if (result.error) {
      console.error("Like Reel error:", result.error);
      setReels((current) =>
        current.map((item) =>
          item.id === reel.id
            ? {
                ...item,
                likedByMe: reel.likedByMe,
                likes_count: reel.likes_count,
              }
            : item
        )
      );
    }

    setBusy(reel.id, false);
  }

  async function toggleSave(reel: ReelItem) {
    if (!currentUserId || busyIds.has(reel.id)) return;

    setBusy(reel.id, true);
    const optimisticSaved = !reel.savedByMe;

    setReels((current) =>
      current.map((item) =>
        item.id === reel.id
          ? { ...item, savedByMe: optimisticSaved }
          : item
      )
    );

    const result = reel.savedByMe
      ? await supabase
          .from("saved_reels")
          .delete()
          .eq("reel_id", reel.id)
          .eq("user_id", currentUserId)
      : await supabase.from("saved_reels").insert({
          reel_id: reel.id,
          user_id: currentUserId,
        });

    if (result.error) {
      console.error("Save Reel error:", result.error);
      setReels((current) =>
        current.map((item) =>
          item.id === reel.id
            ? { ...item, savedByMe: reel.savedByMe }
            : item
        )
      );
    }

    setBusy(reel.id, false);
  }

  async function shareReel(reel: ReelItem) {
    const url = `${window.location.origin}/reels?reel=${reel.id}`;
    const text = reel.caption?.trim() || "Vezi acest Reel pe Friends.";

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Friends Reels",
          text,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        window.alert("Linkul Reel-ului a fost copiat.");
      }

      void supabase
        .from("reels")
        .update({ shares_count: reel.shares_count + 1 })
        .eq("id", reel.id);

      setReels((current) =>
        current.map((item) =>
          item.id === reel.id
            ? { ...item, shares_count: item.shares_count + 1 }
            : item
        )
      );
    } catch {
      // Utilizatorul poate închide fereastra de distribuire.
    }
  }

  if (loading) {
    return (
      <section className="reels-state-card">
        <LoaderCircle className="reels-state-icon reels-spin" />
        <h2>Se încarcă Reels...</h2>
        <p>Pregătim videoclipurile prietenilor tăi.</p>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="reels-state-card reels-state-error">
        <h2>Nu am putut deschide Reels</h2>
        <p>{loadError}</p>
        <button type="button" onClick={() => void loadReels()}>
          Încearcă din nou
        </button>
      </section>
    );
  }

  if (!hasReels) {
    return (
      <section className="reels-state-card">
        <div className="reels-empty-icon">
          <Upload />
        </div>
        <h2>Primul Reel încă nu a fost publicat</h2>
        <p>
          Infrastructura funcționează. În pachetul următor adăugăm fereastra de
          upload video.
        </p>
        <Link href="/feed">Înapoi la Feed</Link>
      </section>
    );
  }

  return (
    <section className="reels-stage">
      <div ref={feedRef} className="reels-feed" aria-label="Flux Reels">
        {reels.map((reel) => {
          const playing = playingId === reel.id;
          const busy = busyIds.has(reel.id);

          return (
            <article
              key={reel.id}
              data-reel-id={reel.id}
              className="reel-card"
            >
              <div className="reel-video-shell">
                <video
                  ref={(node) => registerVideo(reel.id, node)}
                  src={reel.video_url}
                  poster={reel.thumbnail_url ?? undefined}
                  muted={muted}
                  loop
                  playsInline
                  preload="metadata"
                  onClick={() => togglePlayback(reel.id)}
                  onPlay={() => setPlayingId(reel.id)}
                  onPause={() =>
                    setPlayingId((current) =>
                      current === reel.id ? null : current
                    )
                  }
                  className="reel-video"
                />

                <button
                  type="button"
                  className="reel-video-click-layer"
                  onClick={() => togglePlayback(reel.id)}
                  aria-label={playing ? "Pauză" : "Redare"}
                >
                  <AnimatePresence mode="wait">
                    {!playing && (
                      <motion.span
                        key="play"
                        initial={{ opacity: 0, scale: 0.72 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.72 }}
                        className="reel-center-control"
                      >
                        <Play fill="currentColor" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>

                <div className="reel-top-controls">
                  <span className="reel-live-pill">REEL</span>

                  <div className="reel-top-buttons">
                    <button
                      type="button"
                      onClick={() => setMuted((current) => !current)}
                      aria-label={muted ? "Pornește sunetul" : "Oprește sunetul"}
                      title={muted ? "Pornește sunetul" : "Oprește sunetul"}
                    >
                      {muted ? <VolumeX /> : <Volume2 />}
                    </button>

                    <button
                      type="button"
                      aria-label="Mai multe opțiuni"
                      title="Mai multe opțiuni"
                    >
                      <MoreHorizontal />
                    </button>
                  </div>
                </div>

                <div className="reel-gradient" aria-hidden="true" />

                <div className="reel-caption">
                  <Link
                    href={`/profile/${reel.user_id}`}
                    className="reel-author"
                  >
                    <span className="reel-avatar">
                      {reel.profile?.avatar_url ? (
                        <img
                          src={reel.profile.avatar_url}
                          alt={authorName(reel.profile)}
                        />
                      ) : (
                        initials(reel.profile)
                      )}
                    </span>

                    <span>
                      <strong>{authorName(reel.profile)}</strong>
                      <small>{authorHandle(reel.profile)}</small>
                    </span>
                  </Link>

                  {reel.caption && <p>{reel.caption}</p>}

                  {(reel.music_title || reel.location) && (
                    <div className="reel-meta">
                      {reel.music_title && <span>♫ {reel.music_title}</span>}
                      {reel.location && <span>• {reel.location}</span>}
                    </div>
                  )}

                  <span className="reel-date">
                    {new Intl.DateTimeFormat("ro-RO", {
                      day: "numeric",
                      month: "long",
                    }).format(new Date(reel.created_at))}
                  </span>
                </div>

                <aside className="reel-actions" aria-label="Acțiuni Reel">
                  <button
                    type="button"
                    className={reel.likedByMe ? "is-active is-liked" : ""}
                    onClick={() => void toggleLike(reel)}
                    disabled={busy}
                    aria-label={reel.likedByMe ? "Elimină aprecierea" : "Apreciază"}
                  >
                    <span>
                      <Heart fill={reel.likedByMe ? "currentColor" : "none"} />
                    </span>
                    <small>{formatCount(reel.likes_count)}</small>
                  </button>

                  <button
                    type="button"
                    title="Comentariile vin în Pack R1.2"
                    aria-label="Comentarii"
                  >
                    <span>
                      <MessageCircle />
                    </span>
                    <small>{formatCount(reel.comments_count)}</small>
                  </button>

                  <button
                    type="button"
                    onClick={() => void shareReel(reel)}
                    aria-label="Distribuie"
                  >
                    <span>
                      <Share2 />
                    </span>
                    <small>{formatCount(reel.shares_count)}</small>
                  </button>

                  <button
                    type="button"
                    className={reel.savedByMe ? "is-active" : ""}
                    onClick={() => void toggleSave(reel)}
                    disabled={busy}
                    aria-label={reel.savedByMe ? "Elimină din salvate" : "Salvează"}
                  >
                    <span>
                      <Bookmark fill={reel.savedByMe ? "currentColor" : "none"} />
                    </span>
                    <small>Salvează</small>
                  </button>
                </aside>

                <button
                  type="button"
                  className="reel-small-play"
                  onClick={() => togglePlayback(reel.id)}
                  aria-label={playing ? "Pauză" : "Redare"}
                >
                  {playing ? <Pause /> : <Play />}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}