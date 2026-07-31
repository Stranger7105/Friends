"use client";

import { useMemo } from "react";
import type {
  MessengerConversation,
  MessengerMessage,
} from "@/types/messenger";
import { useMessengerContext } from "@/contexts/MessengerContext";
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

  const messages = activeConversationId
    ? messagesByConversation[activeConversationId] ?? []
    : [];

  async function sendLocalMessage(text: string) {
    if (!activeConversationId) return;

    appendMessage({
      id: crypto.randomUUID(),
      conversationId: activeConversationId,
      senderId: currentUserId,
      kind: "text",
      text,
      attachments: [],
      replyToId: null,
      editedAt: null,
      createdAt: new Date().toISOString(),
      status: "sending",
    });
  }

  return (
    <div className={styles.shell}>
      <ChatList
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelect={setActiveConversationId}
      />

      <ChatWindow
        conversation={activeConversation}
        messages={messages}
        currentUserId={currentUserId}
        onSend={sendLocalMessage}
      />
    </div>
  );
}
