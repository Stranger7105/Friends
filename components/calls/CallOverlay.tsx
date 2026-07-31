"use client";

import type { CallKind, CallProfile, CallStatus } from "./types";

type Props = {
  open: boolean;
  status: CallStatus;
  kind: CallKind;
  profile: CallProfile | null;
  isIncoming: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
  durationSeconds: number;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

function statusText(status: CallStatus, incoming: boolean) {
  if (status === "ringing") return incoming ? "Apel primit" : "Se apelează…";
  if (status === "calling") return "Se apelează…";
  if (status === "connecting") return "Se conectează…";
  if (status === "active") return "Conectat";
  if (status === "rejected") return "Apel refuzat";
  if (status === "failed") return "Conexiunea a eșuat";
  if (status === "ended") return "Apel încheiat";
  return "";
}

export default function CallOverlay({
  open,
  status,
  kind,
  profile,
  isIncoming,
  isMuted,
  isCameraOff,
  durationSeconds,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
  onToggleCamera,
}: Props) {
  if (!open || !profile) return null;

  const active = status === "active";
  const incomingRinging = isIncoming && status === "ringing";

  return (
    <div className="friends-call-layer" role="dialog" aria-modal="true">
      <div className="friends-call-screen">
        <div className="friends-call-person">
          <div className="friends-call-avatar">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" />
            ) : (
              <span>{initials(profile.name)}</span>
            )}
          </div>

          <h2>{profile.name}</h2>
          <p>{statusText(status, isIncoming)}</p>

          {active && (
            <strong className="friends-call-duration">
              {formatDuration(durationSeconds)}
            </strong>
          )}
        </div>

        <div className="friends-call-controls">
          {incomingRinging ? (
            <>
              <button
                type="button"
                className="friends-call-control is-reject"
                onClick={onReject}
                aria-label="Refuză apelul"
              >
                ✕
                <span>Refuză</span>
              </button>

              <button
                type="button"
                className="friends-call-control is-accept"
                onClick={onAccept}
                aria-label="Acceptă apelul"
              >
                ☎
                <span>Acceptă</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`friends-call-control ${isMuted ? "is-disabled" : ""}`}
                onClick={onToggleMute}
                aria-label={isMuted ? "Pornește microfonul" : "Oprește microfonul"}
              >
                {isMuted ? "🔇" : "🎤"}
                <span>Microfon</span>
              </button>

              {kind === "video" && (
                <button
                  type="button"
                  className={`friends-call-control ${isCameraOff ? "is-disabled" : ""}`}
                  onClick={onToggleCamera}
                  aria-label={isCameraOff ? "Pornește camera" : "Oprește camera"}
                >
                  {isCameraOff ? "🚫" : "📹"}
                  <span>Cameră</span>
                </button>
              )}

              <button
                type="button"
                className="friends-call-control is-reject"
                onClick={onEnd}
                aria-label="Închide apelul"
              >
                ☎
                <span>Închide</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
