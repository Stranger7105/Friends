"use client";

import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import { useEffect, useRef } from "react";
import type { CallContact, CallKind, CallStatus } from "./callTypes";
import type { ConnectionQuality } from "./useGlobalCallManager";

type Props = {
  open: boolean;
  status: CallStatus;
  kind: CallKind;
  contact: CallContact | null;
  isIncoming: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
  durationSeconds: number;
  error: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connectionQuality?: ConnectionQuality;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
};

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function formatDuration(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function qualityLabel(quality: ConnectionQuality | undefined) {
  if (quality === "excellent") return "Conexiune excelentă";
  if (quality === "good") return "Conexiune bună";
  if (quality === "fair") return "Conexiune medie";
  if (quality === "poor") return "Conexiune slabă";
  return "";
}

function statusLabel(status: CallStatus, incoming: boolean) {
  if (status === "ringing") return incoming ? "Apel primit" : "Se apelează…";
  if (status === "calling") return "Se apelează…";
  if (status === "connecting") return "Se conectează…";
  if (status === "active") return "În apel";
  if (status === "rejected") return "Apel refuzat";
  if (status === "failed") return "Conexiunea a eșuat";
  if (status === "ended") return "Apel încheiat";
  return "";
}

export default function GlobalCallOverlay(props: Props) {
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = props.remoteStream;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = props.remoteStream;
  }, [props.remoteStream]);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = props.localStream;
  }, [props.localStream]);

  if (!props.open || !props.contact) return null;
  const incoming = props.isIncoming && props.status === "ringing";
  const videoActive = props.kind === "video" && Boolean(props.remoteStream);

  return (
    <div className="friends-real-call-layer" role="dialog" aria-modal="true" aria-label="Apel Friends">
      <audio ref={remoteAudioRef} autoPlay playsInline />
      <section className={`friends-real-call-screen ${videoActive ? "has-video" : ""}`}>
        {props.kind === "video" && (
          <div className="friends-call-video-stage">
            <video ref={remoteVideoRef} autoPlay playsInline className="friends-call-remote-video" />
            <video ref={localVideoRef} autoPlay playsInline muted className="friends-call-local-video" />
          </div>
        )}

        <div className="friends-real-call-person">
          {!videoActive && (
            <div className="friends-real-call-avatar">
              {props.contact.avatarUrl ? <img src={props.contact.avatarUrl} alt="" /> : initials(props.contact.name)}
            </div>
          )}
          <h2>{props.contact.name}</h2>
          <p>{statusLabel(props.status, props.isIncoming)}</p>
          {props.status === "active" && <strong>{formatDuration(props.durationSeconds)}</strong>}
          {props.status === "active" && qualityLabel(props.connectionQuality) && (
            <small className={`friends-call-quality is-${props.connectionQuality}`}>
              {qualityLabel(props.connectionQuality)}
            </small>
          )}
          {props.error && <span className="friends-real-call-error">{props.error}</span>}
        </div>

        <div className="friends-real-call-controls">
          {incoming ? (
            <>
              <button type="button" className="is-danger" onClick={props.onReject}>
                <PhoneOff size={23} />
                <span>Refuză</span>
              </button>

              <button type="button" className="is-accept" onClick={props.onAccept}>
                {props.kind === "video" ? <Video size={23} /> : <Phone size={23} />}
                <span>{props.kind === "video" ? "Răspunde video" : "Răspunde audio"}</span>
              </button>
            </>
          ) : (
            <>
              <button type="button" className={props.isMuted ? "is-off" : ""} onClick={props.onToggleMute}>
                {props.isMuted ? <MicOff size={23} /> : <Mic size={23} />}<span>Microfon</span>
              </button>
              {props.kind === "video" && (
                <button type="button" className={props.isCameraOff ? "is-off" : ""} onClick={props.onToggleCamera}>
                  {props.isCameraOff ? <VideoOff size={23} /> : <Video size={23} />}<span>Cameră</span>
                </button>
              )}
              <button type="button" className="is-danger" onClick={props.onEnd}><PhoneOff size={23} /><span>Închide</span></button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}