"use client";

import {
  ArrowLeft,
  MoreVertical,
  Phone,
  Video,
} from "lucide-react";

type ChatHeaderProps = {
  title: string;
  subtitle?: string;
  avatarUrl?: string | null;
  initials?: string;
  onBack: () => void;
  onAudioCall?: () => void;
  onVideoCall?: () => void;
  onMenu?: () => void;
};

export default function ChatHeader({
  title,
  subtitle,
  avatarUrl,
  initials = "U",
  onBack,
  onAudioCall,
  onVideoCall,
  onMenu,
}: ChatHeaderProps) {
  return (
    <div className="friends-m2-header">
      <button
        type="button"
        className="friends-m2-header-button"
        onClick={onBack}
        aria-label="Înapoi"
        title="Înapoi"
      >
        <ArrowLeft size={22} />
      </button>

      <div className="friends-m2-avatar" aria-hidden="true">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      <div className="friends-m2-header-person">
        <strong>{title}</strong>

        {subtitle && (
          <span>{subtitle}</span>
        )}
      </div>

      <div className="friends-m2-header-actions">
        <button
          type="button"
          className="friends-m2-header-button"
          onClick={onVideoCall}
          aria-label="Apel video"
          title="Apel video"
          disabled={!onVideoCall}
        >
          <Video size={21} />
        </button>

        <button
          type="button"
          className="friends-m2-header-button"
          onClick={onAudioCall}
          aria-label="Apel audio"
          title="Apel audio"
          disabled={!onAudioCall}
        >
          <Phone size={21} />
        </button>

        <button
          type="button"
          className="friends-m2-header-button"
          onClick={onMenu}
          aria-label="Mai multe opțiuni"
          title="Mai multe opțiuni"
          disabled={!onMenu}
        >
          <MoreVertical size={21} />
        </button>
      </div>
    </div>
  );
}