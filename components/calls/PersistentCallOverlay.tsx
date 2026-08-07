"use client";

import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
} from "lucide-react";
import {
  useEffect,
  useRef,
} from "react";
import useCall from "./useCall";
import useCallRingtone from "./useCallRingtone";

function initials(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) =>
      part.charAt(0).toUpperCase()
    )
    .join("");
}

function formatDuration(
  seconds: number
): string {
  const safe = Math.max(
    0,
    Math.floor(seconds)
  );

  return `${Math.floor(
    safe / 60
  )}:${String(safe % 60).padStart(
    2,
    "0"
  )}`;
}

export default function PersistentCallOverlay() {
  const audioRef =
    useRef<HTMLAudioElement | null>(null);

  const {
    activeCall,
    busy,
    error,
    connectionState,
    muted,
    elapsedSeconds,
    remoteStream,
    acceptCall,
    rejectCall,
    cancelCall,
    endCall,
    toggleMute,
    clearCallError,
  } = useCall();

  useCallRingtone(activeCall);

  useEffect(() => {
    const audio =
      audioRef.current;

    if (!audio) return;

    audio.srcObject =
      remoteStream;

    if (remoteStream) {
      void audio.play().catch(
        () => {
          // Unele browsere cer încă o interacțiune.
          // Accept/Play/Unmute oferă acea interacțiune în practică.
        }
      );
    }

    return () => {
      if (audio) {
        audio.srcObject = null;
      }
    };
  }, [remoteStream]);

  if (!activeCall && !error) {
    return null;
  }

  if (
    !activeCall &&
    error
  ) {
    return (
      <div
        role="alert"
        style={{
          position: "fixed",
          zIndex: 200000,
          right: 14,
          bottom:
            "calc(14px + env(safe-area-inset-bottom))",
          maxWidth: 360,
          padding: 14,
          borderRadius: 16,
          background: "#31151b",
          color: "#fee2e2",
          border:
            "1px solid rgba(248,113,113,0.4)",
          boxShadow:
            "0 18px 60px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ fontWeight: 800 }}>
          Apel Friends
        </div>
        <div
          style={{
            marginTop: 5,
            fontSize: 13,
          }}
        >
          {error}
        </div>
        <button
          type="button"
          onClick={clearCallError}
          style={{
            marginTop: 10,
            border: 0,
            background: "transparent",
            color: "inherit",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Închide
        </button>
      </div>
    );
  }

  if (!activeCall) return null;

  const incomingRinging =
    activeCall.direction ===
      "incoming" &&
    activeCall.status ===
      "ringing";

  const outgoingRinging =
    activeCall.direction ===
      "outgoing" &&
    activeCall.status ===
      "ringing";

  const accepted =
    activeCall.status ===
    "accepted";

  const finished =
    activeCall.status ===
      "rejected" ||
    activeCall.status ===
      "cancelled" ||
    activeCall.status ===
      "ended";

  const connectionLabel =
    connectionState === "connected"
      ? formatDuration(
          elapsedSeconds
        )
      : connectionState ===
          "preparing"
        ? "Pornim microfonul…"
        : connectionState ===
            "connecting"
          ? "Se conectează audio…"
          : connectionState ===
              "failed"
            ? "Conexiune audio eșuată"
            : "Apel acceptat";

  const statusText =
    incomingRinging
      ? "Te apelează"
      : outgoingRinging
        ? "Se apelează…"
        : accepted
          ? connectionLabel
          : activeCall.status ===
              "rejected"
            ? "Apel refuzat"
            : activeCall.status ===
                "cancelled"
              ? "Apel anulat"
              : "Apel încheiat";

  return (
    <>
      <audio
        ref={audioRef}
        autoPlay
        playsInline
        style={{ display: "none" }}
      />

      <div
        role="dialog"
        aria-modal="false"
        aria-label="Apel Friends"
        style={{
          position: "fixed",
          zIndex: 200000,
          left: "50%",
          bottom:
            "calc(18px + env(safe-area-inset-bottom))",
          transform:
            "translateX(-50%)",
          width:
            "min(440px, calc(100vw - 24px))",
          padding: 16,
          borderRadius: 24,
          background:
            "rgba(7,22,27,0.96)",
          color: "#ffffff",
          border:
            "1px solid rgba(110,231,183,0.28)",
          boxShadow:
            "0 24px 80px rgba(0,0,0,0.48)",
          backdropFilter:
            "blur(18px)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 54,
              height: 54,
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
              overflow: "hidden",
              borderRadius: "50%",
              background: "#10b981",
              fontWeight: 850,
            }}
          >
            {activeCall.peerAvatarUrl ? (
              <img
                src={
                  activeCall.peerAvatarUrl
                }
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              initials(
                activeCall.peerName
              ) || "F"
            )}
          </div>

          <div
            style={{
              minWidth: 0,
              flex: 1,
            }}
          >
            <strong
              style={{
                display: "block",
                overflow: "hidden",
                textOverflow:
                  "ellipsis",
                whiteSpace: "nowrap",
                fontSize: 17,
              }}
            >
              {activeCall.peerName}
            </strong>
            <span
              style={{
                fontSize: 13,
                opacity: 0.78,
                color:
                  connectionState ===
                  "connected"
                    ? "#a7f3d0"
                    : "inherit",
              }}
            >
              {statusText}
            </span>
          </div>

          <Phone
            size={20}
            color="#6ee7b7"
          />
        </div>

        {error && (
          <div
            role="alert"
            style={{
              marginTop: 12,
              padding: "8px 10px",
              borderRadius: 12,
              background:
                "rgba(220,38,38,0.18)",
              color: "#fecaca",
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent:
              "flex-end",
            flexWrap: "wrap",
            gap: 9,
            marginTop: 14,
          }}
        >
          {incomingRinging && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void rejectCall()
                }
                style={
                  dangerButtonStyle
                }
              >
                <PhoneOff
                  size={18}
                />
                Refuză
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void acceptCall()
                }
                style={
                  acceptButtonStyle
                }
              >
                <Phone size={18} />
                Acceptă
              </button>
            </>
          )}

          {outgoingRinging && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void cancelCall()
              }
              style={
                dangerButtonStyle
              }
            >
              <PhoneOff size={18} />
              Anulează
            </button>
          )}

          {accepted && (
            <>
              <button
                type="button"
                disabled={
                  connectionState ===
                    "preparing" ||
                  connectionState ===
                    "idle"
                }
                onClick={toggleMute}
                style={
                  secondaryButtonStyle
                }
                aria-label={
                  muted
                    ? "Activează microfonul"
                    : "Oprește microfonul"
                }
              >
                {muted ? (
                  <MicOff size={18} />
                ) : (
                  <Mic size={18} />
                )}
                {muted
                  ? "Microfon oprit"
                  : "Mute"}
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void endCall()
                }
                style={
                  dangerButtonStyle
                }
              >
                <PhoneOff
                  size={18}
                />
                Închide
              </button>
            </>
          )}

          {finished && (
            <span
              style={{
                fontSize: 12,
                opacity: 0.7,
              }}
            >
              Se închide…
            </span>
          )}
        </div>
      </div>
    </>
  );
}

const acceptButtonStyle = {
  minHeight: 44,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "0 16px",
  border: 0,
  borderRadius: 999,
  background: "#10b981",
  color: "#ffffff",
  fontWeight: 800,
  cursor: "pointer",
} as const;

const dangerButtonStyle = {
  ...acceptButtonStyle,
  background: "#dc2626",
} as const;

const secondaryButtonStyle = {
  ...acceptButtonStyle,
  background:
    "rgba(255,255,255,0.12)",
  border:
    "1px solid rgba(255,255,255,0.16)",
} as const;
