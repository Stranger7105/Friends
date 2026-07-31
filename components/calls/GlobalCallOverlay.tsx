"use client";

import { Mic, MicOff, Phone, PhoneOff, Users, Video, VideoOff } from "lucide-react";
import { useEffect, useRef } from "react";
import type {
  CallContact,
  CallKind,
  CallMode,
  CallStatus,
  ConferenceInvite,
  ConferenceParticipant,
} from "./callTypes";
import type { ConnectionQuality } from "./useGlobalCallManager";

type Props = {
  open: boolean;
  status: CallStatus;
  mode: CallMode;
  kind: CallKind;
  contact: CallContact | null;
  isIncoming: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
  durationSeconds: number;
  error: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  conferenceInvite: ConferenceInvite | null;
  conferenceParticipants: ConferenceParticipant[];
  conferenceRemoteStreams: Map<string, MediaStream>;
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

function statusLabel(status: CallStatus, incoming: boolean, mode: CallMode) {
  if (status === "ringing") return incoming ? (mode === "conference" ? "Invitație la apelul grupului" : "Apel primit") : "Se apelează…";
  if (status === "calling") return mode === "conference" ? "Se invită membrii grupului…" : "Se apelează…";
  if (status === "connecting") return "Se conectează…";
  if (status === "active") return mode === "conference" ? "Apel de grup activ" : "În apel";
  if (status === "rejected") return "Apel refuzat";
  if (status === "failed") return "Conexiunea a eșuat";
  if (status === "ended") return "Apel încheiat";
  return "";
}

function StreamVideo({ stream, muted = false, className }: { stream: MediaStream | null; muted?: boolean; className: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} className={className} />;
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

  if (!props.open || (!props.contact && !props.conferenceInvite)) return null;

  const incoming = props.isIncoming && props.status === "ringing";
  const conference = props.mode === "conference";
  const title = conference
    ? props.conferenceInvite?.host.name || props.contact?.name || "Apel de grup"
    : props.contact?.name || "Apel Friends";
  const videoActive = props.kind === "video" && Boolean(props.remoteStream);

  const connectedParticipants = props.conferenceParticipants.filter((participant) => participant.status !== "left");

  return (
    <div className="friends-real-call-layer" role="dialog" aria-modal="true" aria-label="Apel Friends">
      {!conference && <audio ref={remoteAudioRef} autoPlay playsInline />}
      {conference && Array.from(props.conferenceRemoteStreams.entries()).map(([id, stream]) => (
        <audio key={`audio-${id}`} autoPlay playsInline ref={(element) => { if (element) element.srcObject = stream; }} />
      ))}

      <section className={`friends-real-call-screen ${videoActive || conference ? "has-video" : ""} ${conference ? "is-conference" : ""}`}>
        {conference && props.kind === "video" && props.status !== "ringing" ? (
          <div className="friends-conference-grid">
            <div className="friends-conference-tile is-local">
              <StreamVideo stream={props.localStream} muted className="friends-conference-video" />
              <span>Tu</span>
            </div>
            {connectedParticipants.map((participant) => {
              const stream = props.conferenceRemoteStreams.get(participant.id) || participant.stream;
              return (
                <div key={participant.id} className="friends-conference-tile">
                  {stream && !participant.isCameraOff ? (
                    <StreamVideo stream={stream} className="friends-conference-video" />
                  ) : (
                    <div className="friends-conference-avatar">{participant.avatarUrl ? <img src={participant.avatarUrl} alt="" /> : initials(participant.name)}</div>
                  )}
                  <span>{participant.name}{participant.isMuted ? " · microfon oprit" : ""}</span>
                </div>
              );
            })}
          </div>
        ) : props.kind === "video" && !conference ? (
          <div className="friends-call-video-stage">
            <video ref={remoteVideoRef} autoPlay playsInline className="friends-call-remote-video" />
            <video ref={localVideoRef} autoPlay playsInline muted className="friends-call-local-video" />
          </div>
        ) : null}

        <div className="friends-real-call-person">
          {conference ? (
            <div className="friends-real-call-avatar"><Users size={40} /></div>
          ) : !videoActive && (
            <div className="friends-real-call-avatar">
              {props.contact?.avatarUrl ? <img src={props.contact.avatarUrl} alt="" /> : initials(title)}
            </div>
          )}
          <h2>{conference ? (incoming ? `${title} te invită` : "Apel de grup") : title}</h2>
          <p>{statusLabel(props.status, props.isIncoming, props.mode)}</p>
          {conference && <small>{Math.max(1, connectedParticipants.length + (props.status === "active" ? 1 : 0))} participanți</small>}
          {props.status === "active" && <strong>{formatDuration(props.durationSeconds)}</strong>}
          {!conference && props.status === "active" && qualityLabel(props.connectionQuality) && (
            <small className={`friends-call-quality is-${props.connectionQuality}`}>{qualityLabel(props.connectionQuality)}</small>
          )}
          {props.error && <span className="friends-real-call-error">{props.error}</span>}
        </div>

        <div className="friends-real-call-controls">
          {incoming ? (
            <>
              <button type="button" className="is-danger" onClick={props.onReject}><PhoneOff size={23} /><span>Refuză</span></button>
              <button type="button" className="is-accept" onClick={props.onAccept}>
                {props.kind === "video" ? <Video size={23} /> : <Phone size={23} />}
                <span>{conference ? "Intră în apel" : props.kind === "video" ? "Răspunde video" : "Răspunde audio"}</span>
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
              <button type="button" className="is-danger" onClick={props.onEnd}><PhoneOff size={23} /><span>{conference ? "Părăsește" : "Închide"}</span></button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
