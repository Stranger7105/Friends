"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MessengerMessage } from "../types";
import ReactionBar from "./ReactionBar";
import ReactionPicker from "./ReactionPicker";
import MessageEditor from "./MessageEditor";
import MessageDeleteMenu from "./MessageDeleteMenu";
import AudioMessagePlayer from "./AudioMessagePlayer";

type MessageListProps = {
  messages: MessengerMessage[];
  currentUserId: string;
  onReply: (message: MessengerMessage) => void;
  onReact: (
    messageId: string,
    emoji: string
  ) => void | Promise<boolean>;
  onEdit: (
    messageId: string,
    text: string
  ) => Promise<boolean>;
  editingMessageId: string | null;
  deletingMessageId: string | null;
  onDeleteForMe: (messageId: string) => Promise<boolean>;
  onDeleteForEveryone: (
    messageId: string
  ) => Promise<boolean>;
};

function formatAudioDuration(seconds?: number): string {
  const safe = Math.max(0, seconds ?? 0);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

function statusLabel(message: MessengerMessage): string {
  if (message.status === "sending") return "…";
  if (message.status === "failed") return "!";
  if (message.status === "seen") return "✓✓";
  if (message.status === "delivered") return "✓✓";
  return "✓";
}

export default function MessageList({
  messages,
  currentUserId,
  onReply,
  onReact,
  onEdit,
  editingMessageId,
  deletingMessageId,
  onDeleteForMe,
  onDeleteForEveryone,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pickerMessageId, setPickerMessageId] =
    useState<string | null>(null);
  const [editorMessageId, setEditorMessageId] =
    useState<string | null>(null);
  const [deleteMenuMessageId, setDeleteMenuMessageId] =
    useState<string | null>(null);

  const messagesById = useMemo(
    () =>
      new Map(
        messages.map((message) => [message.id, message])
      ),
    [messages]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  function startLongPress(messageId: string) {
    if (messageId.startsWith("temporary-")) return;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    longPressTimerRef.current = setTimeout(() => {
      setPickerMessageId(messageId);
    }, 520);
  }

  function cancelLongPress() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  if (messages.length === 0) {
    return (
      <div
        style={{
          height: "100%",
          display: "grid",
          placeItems: "center",
          color: "#8b95a7",
        }}
      >
        Nu există mesaje încă.
      </div>
    );
  }

  return (
    <div
      onClick={() => setPickerMessageId(null)}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {messages.map((message) => {
       

        const isMine = message.senderId === currentUserId;
        const repliedMessage = message.replyToId
          ? messagesById.get(message.replyToId)
          : undefined;
        const ownReaction = message.reactions.find(
          (reaction) => reaction.userId === currentUserId
        );

        return (
          <div
            key={message.id}
            style={{
              display: "flex",
              justifyContent: isMine
                ? "flex-end"
                : "flex-start",
            }}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              onMouseEnter={() => {
                if (
                  !message.id.startsWith("temporary-") &&
                  !message.deletedForEveryone &&
                  editorMessageId !== message.id
                ) {
                  setPickerMessageId(message.id);
                }
              }}
              onMouseLeave={() => {
                if (pickerMessageId === message.id) {
                  setPickerMessageId(null);
                }
              }}
              onTouchStart={() => startLongPress(message.id)}
              onTouchEnd={cancelLongPress}
              onTouchCancel={cancelLongPress}
              style={{
                position: "relative",
                maxWidth: "78%",
                padding: "10px 14px",
                borderRadius: 18,
                background: isMine ? "#10b981" : "#ffffff",
                color: isMine ? "#ffffff" : "#111827",
                opacity: message.status === "failed" ? 0.7 : 1,
              }}
            >
              {pickerMessageId === message.id &&
                !message.deletedForEveryone && (
                <div
                  style={{
                    position: "absolute",
                    zIndex: 20,
                    top: -50,
                    right: isMine ? 0 : "auto",
                    left: isMine ? "auto" : 0,
                  }}
                >
                  <ReactionPicker
                    selectedEmoji={ownReaction?.emoji}
                    onSelect={async (emoji) => {
                      await onReact(message.id, emoji);
                    }}
                    onClose={() => setPickerMessageId(null)}
                  />
                </div>
              )}

              {message.replyToId && (
                <div
                  style={{
                    marginBottom: 7,
                    padding: "6px 8px",
                    borderLeft: `3px solid ${
                      isMine ? "#d1fae5" : "#10b981"
                    }`,
                    borderRadius: 7,
                    background: isMine
                      ? "rgba(0,0,0,0.13)"
                      : "rgba(16,185,129,0.1)",
                    fontSize: 12,
                    opacity: 0.9,
                  }}
                >
                  {repliedMessage?.deletedForEveryone
                    ? "Acest mesaj a fost șters"
                    : repliedMessage?.audioPath
                      ? "🎙️ Mesaj vocal"
                      : repliedMessage?.text ??
                        "Mesajul original nu mai este disponibil"}
                </div>
              )}

              {message.deletedForEveryone ? (
                <p
                  style={{
                    margin: 0,
                    fontStyle: "italic",
                    opacity: 0.72,
                  }}
                >
                  Acest mesaj a fost șters
                </p>
              ) : message.audioPath ? (
                message.status === "sending" ||
                message.audioPath === "temporary" ? (
                  <div
                    style={{
                      minWidth: 220,
                      padding: "12px 14px",
                      borderRadius: 12,
                      background: isMine
                        ? "rgba(0,0,0,0.12)"
                        : "rgba(16,185,129,0.1)",
                    }}
                  >
                    🎙️ Se încarcă mesajul vocal...
                  </div>
                ) : (
                  <AudioMessagePlayer
                    messageId={message.id}
                    audioPath={message.audioPath}
                    durationSeconds={message.audioDuration}
                    isMine={isMine}
                  />
                )
              ) : editorMessageId === message.id ? (
                <MessageEditor
                  initialText={message.text}
                  saving={editingMessageId === message.id}
                  onSave={(text) => onEdit(message.id, text)}
                  onCancel={() => setEditorMessageId(null)}
                />
              ) : (
                <p
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                  }}
                >
                  {message.text}
                </p>
              )}

              {!message.deletedForEveryone && (
                <ReactionBar
                  reactions={message.reactions}
                  currentUserId={currentUserId}
                  onSelect={async (emoji) => {
                    await onReact(message.id, emoji);
                  }}
                />
              )}

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 8,
                  marginTop: 5,
                  fontSize: 11,
                  opacity: 0.72,
                }}
              >
                <button
                  type="button"
                  onClick={() => onReply(message)}
                  disabled={
                    editorMessageId === message.id ||
                    message.deletedForEveryone
                  }
                  style={{
                    border: 0,
                    padding: 0,
                    background: "transparent",
                    color: "inherit",
                    fontSize: 11,
                    cursor: "pointer",
                    opacity:
                      editorMessageId === message.id ||
                      message.deletedForEveryone
                        ? 0.45
                        : 0.9,
                  }}
                >
                  Răspunde
                </button>

                {isMine &&
                  !message.id.startsWith("temporary-") &&
                  message.status !== "failed" &&
                  !message.deletedForEveryone &&
                  !message.audioPath && (
                    <button
                      type="button"
                      onClick={() => {
                        setPickerMessageId(null);
                        setEditorMessageId(message.id);
                      }}
                      disabled={
                        editingMessageId !== null ||
                        editorMessageId === message.id
                      }
                      style={{
                        border: 0,
                        padding: 0,
                        background: "transparent",
                        color: "inherit",
                        fontSize: 11,
                        cursor: "pointer",
                        opacity:
                          editingMessageId !== null ||
                          editorMessageId === message.id
                            ? 0.45
                            : 0.9,
                      }}
                    >
                      Editează
                    </button>
                  )}

                {!message.id.startsWith("temporary-") && (
                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setPickerMessageId(null);
                        setEditorMessageId(null);
                        setDeleteMenuMessageId(message.id);
                      }}
                      disabled={
                        deletingMessageId !== null ||
                        editorMessageId === message.id
                      }
                      style={{
                        border: 0,
                        padding: 0,
                        background: "transparent",
                        color: "inherit",
                        fontSize: 11,
                        cursor: "pointer",
                        opacity:
                          deletingMessageId !== null ||
                          editorMessageId === message.id
                            ? 0.45
                            : 0.9,
                      }}
                    >
                      Șterge
                    </button>

                    {deleteMenuMessageId === message.id && (
                      <div
                        style={{
                          position: "absolute",
                          zIndex: 30,
                          right: isMine ? 0 : "auto",
                          left: isMine ? "auto" : 0,
                          bottom: 26,
                        }}
                      >
                        <MessageDeleteMenu
                          canDeleteForEveryone={
                            isMine &&
                            !message.deletedForEveryone
                          }
                          deleting={
                            deletingMessageId === message.id
                          }
                          onDeleteForMe={async () => {
                            await onDeleteForMe(message.id);
                          }}
                          onDeleteForEveryone={async () => {
                            await onDeleteForEveryone(
                              message.id
                            );
                          }}
                          onClose={() =>
                            setDeleteMenuMessageId(null)
                          }
                        />
                      </div>
                    )}
                  </div>
                )}

                <span>
                  {message.editedAt ? "Editat · " : ""}
                  {new Date(message.createdAt).toLocaleTimeString(
                    "ro-RO",
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  )}
                  {isMine ? ` ${statusLabel(message)}` : ""}
                </span>
              </div>
            </div>
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}