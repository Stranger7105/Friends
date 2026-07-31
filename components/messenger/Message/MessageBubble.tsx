import type { MessengerMessage } from "@/types/messenger";
import MessageStatus from "./MessageStatus";
import styles from "./Message.module.css";

type MessageBubbleProps = {
  message: MessengerMessage;
  mine: boolean;
};

export default function MessageBubble({
  message,
  mine,
}: MessageBubbleProps) {
  return (
    <article
      className={`${styles.row} ${mine ? styles.mineRow : styles.theirRow}`}
    >
      <div className={`${styles.bubble} ${mine ? styles.mine : styles.theirs}`}>
        {message.text && <p>{message.text}</p>}

        <footer>
          <time dateTime={message.createdAt}>
            {new Intl.DateTimeFormat("ro-RO", {
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(message.createdAt))}
          </time>

          {mine && <MessageStatus status={message.status} />}
        </footer>
      </div>
    </article>
  );
}
