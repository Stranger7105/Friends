"use client";

import type { MessengerConversation } from "@/types/messenger";
import ChatListItem from "./ChatListItem";
import styles from "./ChatList.module.css";

type ChatListProps = {
  conversations: MessengerConversation[];
  activeConversationId?: string | null;
  onSelect: (conversationId: string) => void;
};

export default function ChatList({
  conversations,
  activeConversationId,
  onSelect,
}: ChatListProps) {
  return (
    <aside className={styles.panel}>
      <header className={styles.header}>
        <div>
          <small>Friends</small>
          <h1>Mesaje</h1>
        </div>
      </header>

      <div className={styles.list}>
        {conversations.length === 0 ? (
          <div className={styles.empty}>
            <strong>Nicio conversație încă</strong>
            <span>Conversațiile tale vor apărea aici.</span>
          </div>
        ) : (
          conversations.map((conversation) => (
            <ChatListItem
              key={conversation.id}
              conversation={conversation}
              active={conversation.id === activeConversationId}
              onSelect={() => onSelect(conversation.id)}
            />
          ))
        )}
      </div>
    </aside>
  );
}
