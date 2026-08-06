"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { getCurrentUserId } from "../services/auth";
import { getConversationById } from "../services/conversations";
import {
  editMessage,
  getMessages,
  markConversationSeen,
  sendMessage,
} from "../services/messages";
import { subscribeToConversationMessages } from "../services/realtime";
import {
  deleteMessageForEveryone,
  deleteMessageForMe,
} from "../services/deletions";
import { sendVoiceMessage } from "../services/voiceMessages";
import {
  getReactionsForMessages,
  setMessageReaction,
} from "../services/reactions";
import {
  createReactionRealtimeSession,
  type ReactionRealtimeSession,
} from "../services/reactionRealtime";
import {
  createTypingSession,
  type TypingSession,
} from "../services/typing";
import useMessageSound from "./useMessageSound";
import type {
  MessengerConversation,
  MessengerMessage,
  VoiceRecording,
} from "../types";

export default function useConversation(conversationId: string) {
  const [currentUserId, setCurrentUserId] = useState("");
  const [conversation, setConversation] =
    useState<MessengerConversation | null>(null);
  const [messages, setMessages] =
    useState<MessengerMessage[]>([]);
  const [replyToMessage, setReplyToMessage] =
    useState<MessengerMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [editingMessageId, setEditingMessageId] =
    useState<string | null>(null);
  const [deletingMessageId, setDeletingMessageId] =
    useState<string | null>(null);
  const [otherUserIsTyping, setOtherUserIsTyping] =
    useState(false);
  const [error, setError] = useState("");

  const { playSound } = useMessageSound(currentUserId);

  const typingSessionRef = useRef<TypingSession | null>(null);
  const reactionRealtimeSessionRef =
    useRef<ReactionRealtimeSession | null>(null);
  const localTypingTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteTypingTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshReactionsForMessage = useCallback(
    async (messageId: string) => {
      try {
        const reactionsByMessage = await getReactionsForMessages([
          messageId,
        ]);

        const reactions =
          reactionsByMessage.get(messageId) ?? [];

        setMessages((current) =>
          current.map((message) =>
            message.id === messageId
              ? {
                  ...message,
                  reactions,
                }
              : message
          )
        );
      } catch (reactionError) {
        console.error(
          reactionError instanceof Error
            ? reactionError.message
            : "Reacțiile nu au putut fi sincronizate."
        );
      }
    },
    []
  );

  const markSeen = useCallback(
    async (userId: string) => {
      if (!userId || document.visibilityState !== "visible") {
        return;
      }

      try {
        await markConversationSeen(conversationId, userId);

        setMessages((current) =>
          current.map((message) =>
            message.senderId !== userId &&
            message.status !== "seen"
              ? {
                  ...message,
                  status: "seen",
                }
              : message
          )
        );
      } catch (seenError) {
        console.error(
          seenError instanceof Error
            ? seenError.message
            : "Mesajele nu au putut fi marcate ca văzute."
        );
      }
    },
    [conversationId]
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setReplyToMessage(null);

      const userId = await getCurrentUserId();
      const [conversationData, messageData] = await Promise.all([
        getConversationById(conversationId, userId),
        getMessages(conversationId, userId),
      ]);

      const reactionsByMessage = await getReactionsForMessages(
        messageData.map((message) => message.id)
      );

      const messagesWithReactions = messageData.map((message) => ({
        ...message,
        reactions: reactionsByMessage.get(message.id) ?? [],
      }));

      setCurrentUserId(userId);
      setConversation(conversationData);
      setMessages(messagesWithReactions);

      await markSeen(userId);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Conversația nu a putut fi încărcată."
      );
    } finally {
      setLoading(false);
    }
  }, [conversationId, markSeen]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!currentUserId) return;

    return subscribeToConversationMessages(
      conversationId,
      {
        onInsert: (incomingMessage) => {
          if (incomingMessage.senderId === currentUserId) {
            return;
          }

          setMessages((current) => {
            if (
              current.some(
                (message) => message.id === incomingMessage.id
              )
            ) {
              return current;
            }

            return [...current, incomingMessage];
          });

          setOtherUserIsTyping(false);
          void playSound();
          void markSeen(currentUserId);
        },

        onUpdate: (updatedMessage) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === updatedMessage.id
                ? {
                    ...message,
                    ...updatedMessage,
                    reactions: updatedMessage.deletedForEveryone
                      ? []
                      : message.reactions,
                  }
                : message
            )
          );

          if (updatedMessage.deletedForEveryone) {
            setReplyToMessage((current) =>
              current?.id === updatedMessage.id
                ? null
                : current
            );
          }
        },
      }
    );
  }, [
    conversationId,
    currentUserId,
    markSeen,
    playSound,
  ]);

  useEffect(() => {
    if (!currentUserId) return;

    const session = createReactionRealtimeSession({
      conversationId,
      currentUserId,
      onRemoteChange: refreshReactionsForMessage,
    });

    reactionRealtimeSessionRef.current = session;

    return () => {
      reactionRealtimeSessionRef.current = null;
      session.close();
    };
  }, [
    conversationId,
    currentUserId,
    refreshReactionsForMessage,
  ]);

  useEffect(() => {
    if (!currentUserId) return;

    const session = createTypingSession({
      conversationId,
      currentUserId,
      onRemoteTyping: (isTyping) => {
        setOtherUserIsTyping(isTyping);

        if (remoteTypingTimerRef.current) {
          clearTimeout(remoteTypingTimerRef.current);
        }

        if (isTyping) {
          remoteTypingTimerRef.current = setTimeout(() => {
            setOtherUserIsTyping(false);
          }, 2500);
        }
      },
    });

    typingSessionRef.current = session;

    return () => {
      if (localTypingTimerRef.current) {
        clearTimeout(localTypingTimerRef.current);
      }

      if (remoteTypingTimerRef.current) {
        clearTimeout(remoteTypingTimerRef.current);
      }

      typingSessionRef.current = null;
      session.close();
    };
  }, [conversationId, currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void markSeen(currentUserId);
      }
    }

    function handleWindowFocus() {
      void markSeen(currentUserId);
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [currentUserId, markSeen]);

  const setTyping = useCallback((isTyping: boolean) => {
    if (localTypingTimerRef.current) {
      clearTimeout(localTypingTimerRef.current);
    }

    typingSessionRef.current?.send(isTyping);

    if (isTyping) {
      localTypingTimerRef.current = setTimeout(() => {
        typingSessionRef.current?.send(false);
      }, 1200);
    }
  }, []);

  const selectReply = useCallback(
    (message: MessengerMessage) => {
      setReplyToMessage(message);
    },
    []
  );

  const cancelReply = useCallback(() => {
    setReplyToMessage(null);
  }, []);

  const reactToMessage = useCallback(
    async (messageId: string, emoji: string): Promise<boolean> => {
      if (!currentUserId || messageId.startsWith("temporary-")) {
        return false;
      }

      const previousReactions =
        messages.find((message) => message.id === messageId)
          ?.reactions ?? [];

      const previousOwnReaction = previousReactions.find(
        (reaction) => reaction.userId === currentUserId
      );

      const reactionsWithoutOwn = previousReactions.filter(
        (reaction) => reaction.userId !== currentUserId
      );

      const shouldRemove = previousOwnReaction?.emoji === emoji;

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? {
                ...message,
                reactions: shouldRemove
                  ? reactionsWithoutOwn
                  : [
                      ...reactionsWithoutOwn,
                      {
                        id: `temporary-reaction-${crypto.randomUUID()}`,
                        userId: currentUserId,
                        emoji,
                        createdAt: new Date().toISOString(),
                      },
                    ],
              }
            : message
        )
      );

      try {
        const savedReaction = await setMessageReaction(
          messageId,
          currentUserId,
          emoji
        );

        setMessages((current) =>
          current.map((message) =>
            message.id === messageId
              ? {
                  ...message,
                  reactions: savedReaction
                    ? [...reactionsWithoutOwn, savedReaction]
                    : reactionsWithoutOwn,
                }
              : message
          )
        );

        reactionRealtimeSessionRef.current?.announceChange(
          messageId
        );

        return true;
      } catch (reactionError) {
        setMessages((current) =>
          current.map((message) =>
            message.id === messageId
              ? {
                  ...message,
                  reactions: previousReactions,
                }
              : message
          )
        );

        setError(
          reactionError instanceof Error
            ? reactionError.message
            : "Reacția nu a putut fi salvată."
        );

        return false;
      }
    },
    [currentUserId, messages]
  );


  const edit = useCallback(
    async (
      messageId: string,
      text: string
    ): Promise<boolean> => {
      if (
        !currentUserId ||
        messageId.startsWith("temporary-") ||
        editingMessageId
      ) {
        return false;
      }

      const currentMessage = messages.find(
        (message) => message.id === messageId
      );

      if (
        !currentMessage ||
        currentMessage.senderId !== currentUserId
      ) {
        setError("Poți edita doar mesajele tale.");
        return false;
      }

      const content = text.trim();

      if (!content || content === currentMessage.text.trim()) {
        return false;
      }

      const previousMessage = currentMessage;
      const optimisticEditedAt = new Date().toISOString();

      setEditingMessageId(messageId);
      setError("");

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? {
                ...message,
                text: content,
                editedAt: optimisticEditedAt,
              }
            : message
        )
      );

      try {
        const savedMessage = await editMessage(
          messageId,
          currentUserId,
          content
        );

        setMessages((current) =>
          current.map((message) =>
            message.id === messageId
              ? {
                  ...savedMessage,
                  reactions: message.reactions,
                }
              : message
          )
        );

        return true;
      } catch (editError) {
        setMessages((current) =>
          current.map((message) =>
            message.id === messageId
              ? previousMessage
              : message
          )
        );

        setError(
          editError instanceof Error
            ? editError.message
            : "Mesajul nu a putut fi editat."
        );

        return false;
      } finally {
        setEditingMessageId(null);
      }
    },
    [currentUserId, editingMessageId, messages]
  );


  const deleteForMe = useCallback(
    async (messageId: string): Promise<boolean> => {
      if (
        !currentUserId ||
        messageId.startsWith("temporary-") ||
        deletingMessageId
      ) {
        return false;
      }

      const previousMessages = messages;

      setDeletingMessageId(messageId);
      setError("");
      setMessages((current) =>
        current.filter((message) => message.id !== messageId)
      );

      setReplyToMessage((current) =>
        current?.id === messageId ? null : current
      );

      try {
        await deleteMessageForMe(
          messageId,
          currentUserId
        );

        return true;
      } catch (deleteError) {
        setMessages(previousMessages);
        setError(
          deleteError instanceof Error
            ? deleteError.message
            : "Mesajul nu a putut fi șters pentru tine."
        );
        return false;
      } finally {
        setDeletingMessageId(null);
      }
    },
    [
      currentUserId,
      deletingMessageId,
      messages,
    ]
  );

  const deleteForEveryone = useCallback(
    async (messageId: string): Promise<boolean> => {
      if (
        !currentUserId ||
        messageId.startsWith("temporary-") ||
        deletingMessageId
      ) {
        return false;
      }

      const currentMessage = messages.find(
        (message) => message.id === messageId
      );

      if (
        !currentMessage ||
        currentMessage.senderId !== currentUserId
      ) {
        setError(
          "Poți șterge pentru toți doar mesajele tale."
        );
        return false;
      }

      const previousMessage = currentMessage;

      setDeletingMessageId(messageId);
      setError("");

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? {
                ...message,
                text: "Acest mesaj a fost șters",
                editedAt: undefined,
                deletedForEveryone: true,
                reactions: [],
              }
            : message
        )
      );

      setReplyToMessage((current) =>
        current?.id === messageId ? null : current
      );

      try {
        const deletedMessage =
          await deleteMessageForEveryone(
            messageId,
            currentUserId
          );

        setMessages((current) =>
          current.map((message) =>
            message.id === messageId
              ? {
                  ...deletedMessage,
                  reactions: [],
                }
              : message
          )
        );

        return true;
      } catch (deleteError) {
        setMessages((current) =>
          current.map((message) =>
            message.id === messageId
              ? previousMessage
              : message
          )
        );

        setError(
          deleteError instanceof Error
            ? deleteError.message
            : "Mesajul nu a putut fi șters pentru toți."
        );

        return false;
      } finally {
        setDeletingMessageId(null);
      }
    },
    [
      currentUserId,
      deletingMessageId,
      messages,
    ]
  );


  const sendVoice = useCallback(
    async (recording: VoiceRecording): Promise<boolean> => {
      if (!currentUserId || sending) return false;
      setTyping(false);
      const replyToId = replyToMessage?.id;
      const temporaryId = `temporary-voice-${crypto.randomUUID()}`;
      const temporaryMessage: MessengerMessage = {
        id: temporaryId, conversationId, senderId: currentUserId, text: "Mesaj vocal",
        status: "sending", createdAt: new Date().toISOString(), audioPath: "temporary",
        audioDuration: recording.durationSeconds, replyToId, attachments: [], reactions: [],
      };
      setSending(true); setError(""); setMessages((current) => [...current, temporaryMessage]);
      try {
        const savedMessage = await sendVoiceMessage(conversationId, currentUserId, recording, replyToId);
        setMessages((current) => [...current.filter((m) => m.id !== temporaryId && m.id !== savedMessage.id), savedMessage].sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
        setReplyToMessage(null); return true;
      } catch (reason) {
        setMessages((current) => current.map((m) => m.id === temporaryId ? { ...m, status: "failed" } : m));
        setError(reason instanceof Error ? reason.message : "Mesajul vocal nu a putut fi trimis."); return false;
      } finally { setSending(false); }
    }, [conversationId, currentUserId, replyToMessage, sending, setTyping]
  );

  const send = useCallback(
    async (text: string): Promise<boolean> => {
      const content = text.trim();

      if (!content || !currentUserId || sending) {
        return false;
      }

      setTyping(false);

      const replyToId = replyToMessage?.id;
      const temporaryId = `temporary-${crypto.randomUUID()}`;

      const temporaryMessage: MessengerMessage = {
        id: temporaryId,
        conversationId,
        senderId: currentUserId,
        text: content,
        status: "sending",
        createdAt: new Date().toISOString(),
        replyToId,
        attachments: [],
        reactions: [],
      };

      setSending(true);
      setError("");
      setMessages((current) => [...current, temporaryMessage]);

      try {
        const savedMessage = await sendMessage(
          conversationId,
          currentUserId,
          content,
          replyToId
        );

        setMessages((current) => {
          const withoutTemporaryOrDuplicate = current.filter(
            (message) =>
              message.id !== temporaryId &&
              message.id !== savedMessage.id
          );

          return [...withoutTemporaryOrDuplicate, savedMessage].sort(
            (first, second) =>
              new Date(first.createdAt).getTime() -
              new Date(second.createdAt).getTime()
          );
        });

        setReplyToMessage(null);
        return true;
      } catch (sendError) {
        setMessages((current) =>
          current.map((message) =>
            message.id === temporaryId
              ? { ...message, status: "failed" }
              : message
          )
        );
        setError(
          sendError instanceof Error
            ? sendError.message
            : "Mesajul nu a putut fi trimis."
        );
        return false;
      } finally {
        setSending(false);
      }
    },
    [
      conversationId,
      currentUserId,
      replyToMessage,
      sending,
      setTyping,
    ]
  );

  return {
    currentUserId,
    conversation,
    messages,
    replyToMessage,
    loading,
    sending,
    editingMessageId,
    deletingMessageId,
    otherUserIsTyping,
    error,
    reload: load,
    send,
    sendVoice,
    setTyping,
    selectReply,
    cancelReply,
    reactToMessage,
    editMessage: edit,
    deleteMessageForMe: deleteForMe,
    deleteMessageForEveryone: deleteForEveryone,
  };
}
