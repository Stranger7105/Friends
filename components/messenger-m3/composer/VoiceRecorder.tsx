"use client";

import { useEffect } from "react";
import type { VoiceRecording } from "../types";
import useVoiceRecorder from "../hooks/useVoiceRecorder";

type VoiceRecorderProps = {
  sending: boolean;
  onSend: (
    recording: VoiceRecording
  ) => Promise<boolean>;
  onActiveChange?: (active: boolean) => void;
};

function formatDuration(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(
    seconds % 60
  ).padStart(2, "0")}`;
}

const actionButtonStyle = {
  minHeight: 40,
  padding: "0 13px",
  border: 0,
  borderRadius: 999,
  fontWeight: 700,
  cursor: "pointer",
} as const;

export default function VoiceRecorder({
  sending,
  onSend,
  onActiveChange,
}: VoiceRecorderProps) {
  const voice = useVoiceRecorder();
  const active =
    voice.isRecording || voice.recording !== null;

  useEffect(() => {
    onActiveChange?.(active);

    return () => {
      onActiveChange?.(false);
    };
  }, [active, onActiveChange]);

  if (!active) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={() => void voice.start()}
          disabled={sending}
          aria-label="Înregistrează mesaj vocal"
          title="Mesaj vocal"
          style={{
            width: 46,
            height: 46,
            display: "grid",
            placeItems: "center",
            border: 0,
            borderRadius: "50%",
            background: "#0f766e",
            color: "#ffffff",
            fontSize: 21,
            cursor: "pointer",
            opacity: sending ? 0.55 : 1,
          }}
        >
          🎤
        </button>

        {voice.error && (
          <span
            role="alert"
            style={{
              maxWidth: 180,
              marginLeft: 8,
              fontSize: 12,
              color: "#fecaca",
            }}
          >
            {voice.error}
          </span>
        )}
      </div>
    );
  }

  if (voice.isRecording) {
    return (
      <div
        style={{
          width: "100%",
          minWidth: 0,
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: 10,
          padding: 10,
          borderRadius: 18,
          background: "rgba(220,38,38,0.14)",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            minWidth: 0,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 10,
              height: 10,
              flexShrink: 0,
              borderRadius: "50%",
              background: "#ef4444",
            }}
          />

          <strong
            style={{
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatDuration(voice.elapsedSeconds)}
          </strong>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            flexWrap: "wrap",
            gap: 8,
            minWidth: 0,
          }}
        >
          <button
            type="button"
            onClick={voice.cancel}
            style={{
              ...actionButtonStyle,
              background: "rgba(255,255,255,0.08)",
              color: "#fecaca",
            }}
          >
            Anulează
          </button>

          <button
            type="button"
            onClick={voice.stop}
            style={{
              ...actionButtonStyle,
              background: "#ef4444",
              color: "#ffffff",
            }}
          >
            Oprește
          </button>
        </div>
      </div>
    );
  }

  const recording = voice.recording;

  if (!recording) {
    return null;
  }

  return (
    <div
      style={{
        width: "100%",
        minWidth: 0,
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: 10,
        padding: 10,
        borderRadius: 18,
        background: "rgba(16,185,129,0.13)",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          minWidth: 0,
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 20 }}>
          🎙️
        </span>

        <strong
          style={{
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          Înregistrare{" "}
          {formatDuration(recording.durationSeconds)}
        </strong>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={voice.clearRecording}
          disabled={sending}
          style={{
            ...actionButtonStyle,
            background: "rgba(255,255,255,0.08)",
            color: "#fecaca",
            opacity: sending ? 0.55 : 1,
          }}
        >
          Șterge
        </button>

        <button
          type="button"
          disabled={sending}
          onClick={async () => {
            const sent = await onSend(recording);

            if (sent) {
              // Reset complet; imediat reapare butonul 🎤.
              voice.clearRecording();
            }
          }}
          style={{
            ...actionButtonStyle,
            background: "#10b981",
            color: "#ffffff",
            opacity: sending ? 0.55 : 1,
          }}
        >
          {sending ? "Se trimite..." : "Trimite"}
        </button>
      </div>
    </div>
  );
}
