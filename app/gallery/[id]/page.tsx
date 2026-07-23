"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import "@/styles/aurora-gallery.css";

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type PhotoPost = {
  id: number;
  content: string;
  image_path: string;
  created_at: string;
};

type GalleryPhoto = PhotoPost & {
  url: string;
};

function displayName(profile: Profile | null) {
  return profile?.full_name || profile?.username || "Utilizator";
}

function initials(profile: Profile | null) {
  return displayName(profile)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export default function PublicGalleryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const profileId = params?.id;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const activePhoto =
    activeIndex === null ? null : photos[activeIndex] || null;

  const closeViewer = useCallback(() => {
    setActiveIndex(null);
    setZoomed(false);
  }, []);

  const showPrevious = useCallback(() => {
    if (photos.length === 0) return;

    setActiveIndex((current) => {
      if (current === null) return 0;
      return current === 0 ? photos.length - 1 : current - 1;
    });
    setZoomed(false);
  }, [photos.length]);

  const showNext = useCallback(() => {
    if (photos.length === 0) return;

    setActiveIndex((current) => {
      if (current === null) return 0;
      return current === photos.length - 1 ? 0 : current + 1;
    });
    setZoomed(false);
  }, [photos.length]);

  useEffect(() => {
    async function loadGallery() {
      if (!profileId) return;

      setLoading(true);
      setMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const [profileResult, postsResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .eq("id", profileId)
          .single(),

        supabase
          .from("posts")
          .select("id, content, image_path, created_at")
          .eq("user_id", profileId)
          .not("image_path", "is", null)
          .order("created_at", { ascending: false }),
      ]);

      if (profileResult.error) {
        setMessage(`Profilul nu a putut fi încărcat: ${profileResult.error.message}`);
        setLoading(false);
        return;
      }

      setProfile(profileResult.data as Profile);

      if (postsResult.error) {
        setMessage(`Fotografiile nu au putut fi încărcate: ${postsResult.error.message}`);
        setLoading(false);
        return;
      }

      const photoPosts = (postsResult.data || []).filter(
        (post): post is PhotoPost => Boolean(post.image_path)
      );

      const resolvedPhotos = await Promise.all(
        photoPosts.map(async (post) => {
          const { data, error } = await supabase.storage
            .from("post-images")
            .createSignedUrl(post.image_path, 60 * 60);

          if (error || !data?.signedUrl) return null;

          return {
            ...post,
            url: data.signedUrl,
          } satisfies GalleryPhoto;
        })
      );

      setPhotos(
        resolvedPhotos.filter(
          (photo): photo is GalleryPhoto => photo !== null
        )
      );
      setLoading(false);
    }

    void loadGallery();
  }, [profileId, router]);

  useEffect(() => {
    if (activeIndex === null) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeViewer();
      if (event.key === "ArrowLeft") showPrevious();
      if (event.key === "ArrowRight") showNext();
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeIndex, closeViewer, showNext, showPrevious]);

  const galleryTitle = useMemo(
    () => `Galeria lui ${displayName(profile)}`,
    [profile]
  );

  if (loading) {
    return (
      <main className="aurora-gallery-page">
        <div className="aurora-gallery-state">Se încarcă galeria...</div>
      </main>
    );
  }

  return (
    <main className="aurora-gallery-page">
      <div className="aurora-gallery-glow aurora-gallery-glow-one" />
      <div className="aurora-gallery-glow aurora-gallery-glow-two" />

      <div className="aurora-gallery-shell">
        <header className="aurora-gallery-header">
          <div className="aurora-gallery-identity">
            <div className="aurora-gallery-avatar">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" />
              ) : (
                initials(profile)
              )}
            </div>

            <div>
              <p className="aurora-gallery-kicker">FRIENDS AURORA</p>
              <h1>{galleryTitle}</h1>
              <p>
                {photos.length} {photos.length === 1 ? "fotografie" : "fotografii"}
              </p>
            </div>
          </div>

          <div className="aurora-gallery-actions">
            <Link href={`/profile/${profileId}`} className="aurora-gallery-button">
              Înapoi la profil
            </Link>
            <Link href="/feed" className="aurora-gallery-button secondary">
              Feed
            </Link>
          </div>
        </header>

        {message && <div className="aurora-gallery-alert">{message}</div>}

        {photos.length === 0 ? (
          <section className="aurora-gallery-empty">
            <div className="aurora-gallery-empty-icon">📸</div>
            <h2>Galeria este încă goală</h2>
            <p>
              Fotografiile adăugate în postări vor apărea automat aici.
            </p>
          </section>
        ) : (
          <section className="aurora-masonry" aria-label="Galerie foto">
            {photos.map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                className="aurora-gallery-card"
                onClick={() => setActiveIndex(index)}
                aria-label={`Deschide fotografia ${index + 1}`}
              >
                <img
                  src={photo.url}
                  alt={photo.content || `Fotografie ${index + 1}`}
                  loading="lazy"
                />

                <span className="aurora-gallery-card-overlay">
                  <span className="aurora-gallery-card-date">
                    {new Date(photo.created_at).toLocaleDateString("ro-RO")}
                  </span>
                  {photo.content && (
                    <span className="aurora-gallery-card-caption">
                      {photo.content}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </section>
        )}
      </div>

      {activePhoto && activeIndex !== null && (
        <div
          className="aurora-viewer"
          role="dialog"
          aria-modal="true"
          aria-label="Vizualizare fotografie"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeViewer();
          }}
        >
          <button
            type="button"
            className="aurora-viewer-close"
            onClick={closeViewer}
            aria-label="Închide"
          >
            ×
          </button>

          {photos.length > 1 && (
            <>
              <button
                type="button"
                className="aurora-viewer-nav previous"
                onClick={showPrevious}
                aria-label="Fotografia precedentă"
              >
                ‹
              </button>

              <button
                type="button"
                className="aurora-viewer-nav next"
                onClick={showNext}
                aria-label="Fotografia următoare"
              >
                ›
              </button>
            </>
          )}

          <div className="aurora-viewer-content">
            <button
              type="button"
              className={`aurora-viewer-image-button ${zoomed ? "zoomed" : ""}`}
              onClick={() => setZoomed((value) => !value)}
              aria-label={zoomed ? "Micșorează fotografia" : "Mărește fotografia"}
            >
              <img
                src={activePhoto.url}
                alt={activePhoto.content || "Fotografie"}
              />
            </button>

            <div className="aurora-viewer-info">
              <div>
                <strong>
                  {activeIndex + 1} / {photos.length}
                </strong>
                <span>
                  {new Date(activePhoto.created_at).toLocaleString("ro-RO")}
                </span>
              </div>

              {activePhoto.content && <p>{activePhoto.content}</p>}

              <span className="aurora-viewer-hint">
                Click pe fotografie pentru zoom · săgeți pentru navigare · Esc pentru închidere
              </span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
