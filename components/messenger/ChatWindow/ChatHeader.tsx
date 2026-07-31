import type { MessengerConversation } from "@/types/messenger";
import Avatar from "../Shared/Avatar";
import styles from "./ChatWindow.module.css";

export default function ChatHeader({
  conversation,
}: {
  conversation: MessengerConversation | null;
}) {
  const profile = conversation?.members[0]?.profile;
  const title =
    conversation?.title ??
    profile?.fullName ??
    profile?.username ??
    "Alege o conversație";

  return (
    <header className={styles.header}>
      <div className={styles.identity}>
        <Avatar
          src={conversation?.avatarUrl ?? profile?.avatarUrl}
          name={title}
        />
        <div>
          <strong>{title}</strong>
          <span>{conversation ? "Messenger Friends" : "Nicio conversație selectată"}</span>
        </div>
      </div>

      {conversation && (
        <div className={styles.actions} aria-label="Acțiuni conversație">
          <button type="button" title="Apel audio" disabled>📞</button>
          <button type="button" title="Apel video" disabled>📹</button>
          <button type="button" title="Mai multe opțiuni" disabled>•••</button>
        </div>
      )}
    </header>
  );
}
