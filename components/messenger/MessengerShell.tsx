"use client";

import { useMemo } from "react";
import type {
  MessengerConversation,
  MessengerMessage,
} from "@/types/messenger";
import { useMessengerContext } from "@/contexts/MessengerContext";
import useMessages from "./hooks/useMessages";
import ChatList from "./ChatList/ChatList";
import ChatWindow from "./ChatWindow/ChatWindow";
import styles from "./MessengerShell.module.css";

type MessengerShellProps = {
  currentUserId: string;
  initialConversations?: MessengerConversation[];
  initialMessages?: Record<string, MessengerMessage[]>;
};

export default function MessengerShell({
  currentUserId,
}: MessengerShellProps) {
  const {
    activeConversationId,
    conversations,
    messagesByConversation,
    setActiveConversationId,
    appendMessage,
  } = useMessengerContext();

  const activeConversation = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.id === activeConversationId
      ) ?? null,
    [activeConversationId, conversations]
  );

  const usesSupabase =
    activeConversationId !== null &&
    Number.isFinite(Number(activeConversationId));

  const {
  messages,
  loading,
  sending,
  error,
  sendMessage,
  reactToMessage,
} = useMessages({
    conversationId: usesSupabase ? activeConversationId : null,
    currentUserId,
  });

  const localMessages = activeConversationId
    ? messagesByConversation[activeConversationId] ?? []
    : [];

  const visibleMessages = usesSupabase
  ? messages
  : localMessages;

  async function sendLocalMessage(
  text: string,
  replyToId: string | null = null
) {
    const content = text.trim();

    if (!content || !activeConversationId) return;

    appendMessage({
      id: crypto.randomUUID(),
      conversationId: activeConversationId,
      senderId: currentUserId,
      kind: "text",
      text: content,
      attachments: [],
      replyToId,
      editedAt: null,
      createdAt: new Date().toISOString(),
      status: "sending",
    });
  }

  async function handleSend(
  text: string,
  replyToId: string | null = null
) {
    if (usesSupabase) {
     await sendMessage(text, replyToId);
      return;
    }

    await sendLocalMessage(text, replyToId);
  }

  return (
    <div className={styles.shell}>
      <ChatList
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelect={setActiveConversationId}
      />

      <div className={styles.window}>
        {loading && usesSupabase && (
          <div role="status">Se încarcă mesajele...</div>
        )}

        {error && usesSupabase && (
          <div role="alert">{error}</div>
        )}

        <ChatWindow
          conversation={activeConversation}
          messages={visibleMessages}
          currentUserId={currentUserId}
          onSend={handleSend}
        />

        {sending && usesSupabase && (
          <div role="status">Se trimite...</div>
        )}
      </div>
    </div>
  );
}