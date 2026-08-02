"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

type HoverVideoProps = {
  src: string;
  poster?: string | null;
  className?: string;
  previewMs?: number;
  mediaType?: "image" | "video";
};

type PreviewRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export default function HoverVideo({
  src,
  poster,
  className = "",
  previewMs = 2600,
  mediaType = "video",
}: HoverVideoProps) {
  const hostRef = useRef<HTMLSpanElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const activeRef = useRef(false);

  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(false);
  const [previewRect, setPreviewRect] = useState<PreviewRect | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    const parent = host?.parentElement;

    if (!host || !parent) return;

    const supportsHover = window.matchMedia(
      "(hover: hover) and (pointer: fine)"
    ).matches;

    if (!supportsHover) return;

    function clearTimer() {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    function calculateRect() {
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const scale = 1.28;
      const width = rect.width * scale;
      const height = rect.height * scale;

      setPreviewRect({
        top: rect.top - (height - rect.height) / 2,
        left: rect.left - (width - rect.width) / 2,
        width,
        height,
      });
    }

    function resetVideo() {
      const video = videoRef.current;
      if (!video) return;

      video.pause();

      try {
        video.currentTime = 0;
      } catch {
        // Metadata poate să nu fie încă disponibilă.
      }
    }

    function stopPreview() {
      clearTimer();
      activeRef.current = false;
      resetVideo();
      setActive(false);
      setPreviewRect(null);
    }

    function startPreview() {
      clearTimer();
      activeRef.current = true;
      calculateRect();
      setActive(true);

      timeoutRef.current = window.setTimeout(stopPreview, previewMs);
    }

    function handleViewportChange() {
      if (activeRef.current) calculateRect();
    }

    parent.addEventListener("mouseenter", startPreview);
    parent.addEventListener("mouseleave", stopPreview);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      parent.removeEventListener("mouseenter", startPreview);
      parent.removeEventListener("mouseleave", stopPreview);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
      clearTimer();
      resetVideo();
    };
  }, [mediaType, previewMs, src]);

  useEffect(() => {
    if (!active || !previewRect || mediaType != "video") return;

    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.playsInline = true;

    if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
      video.load();
    }

    void video.play().catch((error) => {
      console.warn("Smart preview nu a putut porni:", error);
      activeRef.current = false;
      setActive(false);
      setPreviewRect(null);
    });
  }, [active, mediaType, previewRect]);

  return (
    <>
      <span
        ref={hostRef}
        className="friends-hover-video-anchor"
        aria-hidden="true"
      />

      {mounted &&
        active &&
        previewRect &&
        createPortal(
          <span
            className="friends-hover-video-portal is-active"
            style={{
              top: previewRect.top,
              left: previewRect.left,
              width: previewRect.width,
              height: previewRect.height,
            }}
            aria-hidden="true"
          >
            {mediaType === "image" ? (
              <img
                src={src}
                alt=""
                className={className}
                draggable={false}
              />
            ) : (
              <video
                ref={videoRef}
                src={src}
                poster={poster ?? undefined}
                muted
                playsInline
                preload="metadata"
                className={className}
              />
            )}
          </span>,
          document.body
        )}
    </>
  );
}
