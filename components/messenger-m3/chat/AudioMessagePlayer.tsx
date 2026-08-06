"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createVoiceSignedUrl } from "../services/voiceMessages";

const PLAYER_EVENT = "friends-messenger-audio-play";

type PlayerEventDetail = {
  playerId: string;
};

type AudioMessagePlayerProps = {
  messageId: string;
  audioPath: string;
  durationSeconds?: number;
  isMine: boolean;
};

function formatDuration(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds)
    ? Math.max(0, Math.floor(seconds))
    : 0;

  return `${Math.floor(safeSeconds / 60)}:${String(
    safeSeconds % 60
  ).padStart(2, "0")}`;
}

export default function AudioMessagePlayer({
  messageId,
  audioPath,
  durationSeconds = 0,
  isMine,
}: AudioMessagePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playerIdRef = useRef(
    `${messageId}-${crypto.randomUUID()}`
  );
  const retryRef = useRef(false);

  const [sourceUrl, setSourceUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(
    Math.max(0, durationSeconds)
  );
  const [error, setError] = useState("");

  const prepareSource = useCallback(
    async (forceRefresh = false): Promise<string> => {
      setLoading(true);
      setError("");

      try {
        const url = await createVoiceSignedUrl(
          audioPath,
          forceRefresh
        );

        setSourceUrl(url);
        return url;
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Mesajul vocal nu poate fi redat."
        );
        throw reason;
      } finally {
        setLoading(false);
      }
    },
    [audioPath]
  );

  useEffect(() => {
    const audio = audioRef.current;

    audio?.pause();
    if (audio) {
      audio.currentTime = 0;
      audio.removeAttribute("src");
      audio.load();
    }

    setSourceUrl("");
    setPlaying(false);
    setCurrentTime(0);
    setDuration(Math.max(0, durationSeconds));
    setError("");
    retryRef.current = false;
  }, [audioPath, durationSeconds]);

  useEffect(() => {
    function stopWhenAnotherPlayerStarts(event: Event) {
      const customEvent =
        event as CustomEvent<PlayerEventDetail>;

      if (
        customEvent.detail?.playerId ===
        playerIdRef.current
      ) {
        return;
      }

      const audio = audioRef.current;

      if (audio && !audio.paused) {
        audio.pause();
      }
    }

    window.addEventListener(
      PLAYER_EVENT,
      stopWhenAnotherPlayerStarts
    );

    return () => {
      window.removeEventListener(
        PLAYER_EVENT,
        stopWhenAnotherPlayerStarts
      );
    };
  }, []);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const togglePlayback = useCallback(async () => {
    const audio = audioRef.current;

    if (!audio || loading) {
      return;
    }

    if (!audio.paused) {
      audio.pause();
      return;
    }

    try {
      let url = sourceUrl;

      if (!url) {
        url = await prepareSource();
      }

      if (audio.src !== url) {
        audio.src = url;
        audio.load();
      }

      window.dispatchEvent(
        new CustomEvent<PlayerEventDetail>(
          PLAYER_EVENT,
          {
            detail: {
              playerId: playerIdRef.current,
            },
          }
        )
      );

      await audio.play();
    } catch (reason) {
      setPlaying(false);
      setError(
        reason instanceof Error
          ? reason.message
          : "Mesajul vocal nu poate fi redat."
      );
    }
  }, [loading, prepareSource, sourceUrl]);

  const handleSeek = useCallback((value: number) => {
    const audio = audioRef.current;

    if (!audio || !Number.isFinite(value)) {
      return;
    }

    audio.currentTime = value;
    setCurrentTime(value);
  }, []);

  const handleAudioError = useCallback(async () => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (retryRef.current) {
      setPlaying(false);
      setLoading(false);
      setError("Mesajul vocal nu poate fi redat.");
      return;
    }

    retryRef.current = true;

    try {
      const refreshedUrl = await prepareSource(true);

      audio.src = refreshedUrl;
      audio.load();
    } catch {
      setPlaying(false);
      setLoading(false);
    }
  }, [prepareSource]);

  const totalDuration = Math.max(
    1,
    Number.isFinite(duration) ? duration : 0,
    durationSeconds
  );

  return (
    <div
      aria-label="Mesaj vocal"
      style={{
        width: "min(300px, 70vw)",
        minWidth: 220,
        display: "grid",
        gridTemplateColumns: "42px minmax(0, 1fr)",
        alignItems: "center",
        gap: 10,
        padding: "9px 11px",
        borderRadius: 14,
        background: isMine
          ? "rgba(0,0,0,0.12)"
          : "rgba(16,185,129,0.1)",
        boxSizing: "border-box",
      }}
    >
      <audio
        ref={audioRef}
        preload="metadata"
        onLoadStart={() => setLoading(true)}
        onCanPlay={() => setLoading(false)}
        onPlaying={() => {
          setLoading(false);
          setPlaying(true);
          setError("");
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);

          if (audioRef.current) {
            audioRef.current.currentTime = 0;
          }
        }}
        onTimeUpdate={(event) => {
          setCurrentTime(event.currentTarget.currentTime);
        }}
        onLoadedMetadata={(event) => {
          const metadataDuration =
            event.currentTarget.duration;

          if (
            Number.isFinite(metadataDuration) &&
            metadataDuration > 0
          ) {
            setDuration(metadataDuration);
          }
        }}
        onError={() => {
          void handleAudioError();
        }}
      />

      <button
        type="button"
        onClick={() => void togglePlayback()}
        disabled={loading && !playing}
        aria-label={playing ? "Pauză" : "Redă"}
        style={{
          width: 42,
          height: 42,
          display: "grid",
          placeItems: "center",
          padding: 0,
          border: 0,
          borderRadius: "50%",
          background: isMine
            ? "rgba(255,255,255,0.24)"
            : "#10b981",
          color: "#ffffff",
          fontSize: 18,
          cursor: "pointer",
          opacity: loading && !playing ? 0.65 : 1,
        }}
      >
        {loading && !playing
          ? "…"
          : playing
            ? "⏸"
            : "▶"}
      </button>

      <div style={{ minWidth: 0 }}>
        <input
          type="range"
          min={0}
          max={totalDuration}
          step={0.05}
          value={Math.min(currentTime, totalDuration)}
          onChange={(event) =>
            handleSeek(Number(event.target.value))
          }
          aria-label="Progres mesaj vocal"
          style={{
            width: "100%",
            margin: 0,
            cursor: "pointer",
            accentColor: isMine ? "#d1fae5" : "#10b981",
          }}
        />

        <div
          style={{
            minHeight: 18,
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            marginTop: 3,
            fontSize: 11,
            opacity: 0.78,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {error ? (
            <span
              role="alert"
              title={error}
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: isMine ? "#fee2e2" : "#b91c1c",
              }}
            >
              Nu se poate reda
            </span>
          ) : (
            <>
              <span>{formatDuration(currentTime)}</span>
              <span>{formatDuration(totalDuration)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
