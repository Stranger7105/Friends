"use client";

import type {
  MessengerConversation,
  MessengerMessage,
} from "@/types/messenger";
import ConversationScreen from "../ConversationScreen";
import styles from "./ChatWindow.module.css";

type ChatWindowProps = {
  conversation: MessengerConversation | null;
  messages: MessengerMessage[];
  currentUserId: string;
  onSend: (text: string) => void | Promise<void>;
};

function getInitials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function ChatWindow({
  conversation,
  messages,
  currentUserId,
  onSend,
}: ChatWindowProps) {
  if (!conversation) {
    return (
      <section className={styles.window}>
        <div className={styles.noConversation}>
          <div className={styles.orb}>💬</div>
          <strong>Alege o conversație</strong>
          <span>Friends Messenger este pregătit.</span>
        </div>
      </section>
    );
  }

  const otherMember =
    conversation.members.find(
      (member) => member.userId !== currentUserId
    ) ?? conversation.members[0];

  const title =
    conversation.title ||
    otherMember?.profile?.fullName ||
    otherMember?.profile?.username ||
    "Conversație";

  const avatarUrl =
    conversation.avatarUrl ||
    otherMember?.profile?.avatarUrl ||
    null;

  return (
    <section className={styles.window}>
      <ConversationScreen
        conversationId={conversation.id}
        currentUserId={currentUserId}
        title={title}
        subtitle="Friends Messenger"
        avatarUrl={avatarUrl}
        initials={getInitials(title) || "F"}
        messages={messages}
        onSend={onSend}
      />
    </section>
  );
}