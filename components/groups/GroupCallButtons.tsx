"use client";

import { Phone, Video } from "lucide-react";
import type { CallContact, CallKind } from "@/components/calls/callTypes";
import { requestGlobalConference } from "@/components/calls/globalCallEvents";

type Props = {
  conversationId: number;
  members: CallContact[];
  disabled?: boolean;
};

export default function GroupCallButtons({ conversationId, members, disabled = false }: Props) {
  function start(kind: CallKind) {
    if (disabled || members.length === 0) return;
    requestGlobalConference({ conversationId, kind, invitees: members });
  }

  return (
    <div className="friends-group-call-buttons">
      <button type="button" disabled={disabled} onClick={() => start("audio")}>
        <Phone size={19} />
        <span>Apel audio</span>
      </button>
      <button type="button" disabled={disabled} onClick={() => start("video")}>
        <Video size={19} />
        <span>Apel video</span>
      </button>
    </div>
  );
}
