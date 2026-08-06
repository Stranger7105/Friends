"use client";

import {
  useCallback,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import useComposer from "../hooks/useComposer";
import type {
  MessengerMessage,
  VoiceRecording,
} from "../types";
import ReplyPreview from "./ReplyPreview";
import VoiceRecorder from "./VoiceRecorder";

type MessageComposerProps = {
  onSend: (text: string) => Promise<boolean>;
  onSendVoice: (
    recording: VoiceRecording
  ) => Promise<boolean>;
  onTypingChange: (isTyping: boolean) => void;
  sending: boolean;
  replyToMessage: MessengerMessage | null;
  onCancelReply: () => void;
};

export default function MessageComposer({
  onSend,
  onSendVoice,
  onTypingChange,
  sending,
  replyToMessage,
  onCancelReply,
}: MessageComposerProps) {
  const { text, setText, clear } = useComposer();
  const [voiceActive, setVoiceActive] = useState(false);

  const handleVoiceActiveChange = useCallback(
    (active: boolean) => {
      setVoiceActive(active);

      if (active) {
        onTypingChange(false);
      }
    },
    [onTypingChange]
  );

  function handleChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const value = event.target.value;

    setText(value);
    onTypingChange(Boolean(value.trim()));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const content = text.trim();

    if (!content || sending || voiceActive) {
      return;
    }

    const sent = await onSend(content);

    if (sent) {
      clear();
      onTypingChange(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        padding: 12,
        paddingBottom:
          "calc(12px + env(safe-area-inset-bottom))",
        borderTop: "1px solid #2a2a2a",
        background: "#10131a",
        boxSizing: "border-box",
      }}
    >
      {replyToMessage && (
        <ReplyPreview
          message={replyToMessage}
          onCancel={onCancelReply}
        />
      )}

      <div
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          minWidth: 0,
        }}
      >
        {!voiceActive && (
          <input
            value={text}
            onChange={handleChange}
            placeholder="Scrie un mesaj..."
            disabled={sending}
            autoComplete="off"
            style={{
              flex: 1,
              minWidth: 0,
              height: 48,
              borderRadius: 24,
              border: "none",
              padding: "0 16px",
              fontSize: 16,
              boxSizing: "border-box",
            }}
          />
        )}

        {!voiceActive && text.trim() ? (
          <button
            type="submit"
            disabled={sending}
            style={{
              minHeight: 44,
              padding: "0 16px",
              border: 0,
              borderRadius: 22,
              background: "#10b981",
              color: "#ffffff",
              fontWeight: 700,
              opacity: sending ? 0.55 : 1,
            }}
          >
            {sending ? "Se trimite..." : "Trimite"}
          </button>
        ) : (
          <div
            style={{
              flex: voiceActive ? 1 : "0 0 auto",
              width: voiceActive ? "100%" : "auto",
              minWidth: 0,
            }}
          >
            <VoiceRecorder
              sending={sending}
              onSend={onSendVoice}
              onActiveChange={handleVoiceActiveChange}
            />
          </div>
        )}
      </div>
    </form>
  );
}
