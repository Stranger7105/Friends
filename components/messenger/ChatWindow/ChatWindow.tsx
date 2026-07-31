"use client";

import type {
  MessengerConversation,
  MessengerMessage,
} from "@/types/messenger";
import ChatHeader from "./ChatHeader";
import ChatBody from "./ChatBody";
import Composer from "../Composer/Composer";
import styles from "./ChatWindow.module.css";

type ChatWindowProps = {
  conversation: MessengerConversation | null;
  messages: MessengerMessage[];
  currentUserId: string;
  onSend: (text: string) => void | Promise<void>;
};

export default function ChatWindow({
  conversation,
  messages,
  currentUserId,
  onSend,
}: ChatWindowProps) {
  return (
    <section className={styles.window}>
      <ChatHeader conversation={conversation} />

      {conversation ? (
        <>
          <ChatBody messages={messages} currentUserId={currentUserId} />
          <Composer onSend={onSend} />
        </>
      ) : (
        <div className={styles.noConversation}>
          <div className={styles.orb}>💬</div>
          <strong>Alege o conversație</strong>
          <span>Friends Messenger este pregătit pentru următorul pas.</span>
        </div>
      )}
    </section>
  );
}
