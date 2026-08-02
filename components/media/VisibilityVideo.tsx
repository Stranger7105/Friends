"use client";

import { useEffect, useRef, useState } from "react";

type VisibilityVideoProps = {
  src: string;
  poster?: string | null;
  className?: string;
  previewMs?: number;
};

export default function VisibilityVideo({
  src,
  poster,
  className = "",
  previewMs = 2200,
}: VisibilityVideoProps) {
  const hostRef = useRef<HTMLSpanElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    if (!window.matchMedia("(hover: none), (pointer: coarse)").matches) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const video = videoRef.current;
        if (!video) return;

        if (entry.isIntersecting && entry.intersectionRatio >= 0.78) {
          setActive(true);
          video.muted = true;

          void video.play().catch(() => {
            setActive(false);
          });

          if (timeoutRef.current !== null) {
            window.clearTimeout(timeoutRef.current);
          }

          timeoutRef.current = window.setTimeout(() => {
            video.pause();
            try {
              video.currentTime = 0;
            } catch {
              // Ignorăm dacă metadata nu este încă disponibilă.
            }
            setActive(false);
          }, previewMs);
        } else {
          if (timeoutRef.current !== null) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }

          video.pause();
          try {
            video.currentTime = 0;
          } catch {
            // Ignorăm.
          }
          setActive(false);
        }
      },
      { threshold: [0, 0.78, 1] }
    );

    observer.observe(host);

    return () => {
      observer.disconnect();

      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [previewMs]);

  return (
    <span
      ref={hostRef}
      className={`friends-visibility-video ${active ? "is-active" : ""}`}
      aria-hidden="true"
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster ?? undefined}
        muted
        playsInline
        preload="none"
        className={className}
      />
    </span>
  );
}
