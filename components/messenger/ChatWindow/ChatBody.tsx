import type { MessengerMessage } from "@/types/messenger";
import MessageBubble from "../Message/MessageBubble";
import styles from "./ChatWindow.module.css";

type ChatBodyProps = {
  messages: MessengerMessage[];
  currentUserId: string;
};

export default function ChatBody({
  messages,
  currentUserId,
}: ChatBodyProps) {
  if (messages.length === 0) {
    return (
      <main className={styles.body}>
        <div className={styles.bodyEmpty}>
          <strong>Începe conversația</strong>
          <span>Mesajele vor apărea aici.</span>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.body}>
      <div className={styles.messageList}>
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            mine={message.senderId === currentUserId}
          />
        ))}
      </div>
    </main>
  );
}
