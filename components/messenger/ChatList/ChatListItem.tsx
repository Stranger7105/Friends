import type { MessengerConversation } from "@/types/messenger";
import Avatar from "../Shared/Avatar";
import TimeLabel from "../Shared/TimeLabel";
import styles from "./ChatList.module.css";

type ChatListItemProps = {
  conversation: MessengerConversation;
  active: boolean;
  onSelect: () => void;
};

export default function ChatListItem({
  conversation,
  active,
  onSelect,
}: ChatListItemProps) {
  const otherMember = conversation.members[0]?.profile;
  const title =
    conversation.title ??
    otherMember?.fullName ??
    otherMember?.username ??
    "Conversație";

  return (
    <button
      type="button"
      className={`${styles.item} ${active ? styles.active : ""}`}
      onClick={onSelect}
    >
      <Avatar
        src={conversation.avatarUrl ?? otherMember?.avatarUrl}
        name={title}
        size="lg"
      />

      <span className={styles.content}>
        <span className={styles.topLine}>
          <strong>{title}</strong>
          <TimeLabel isoDate={conversation.lastMessage?.createdAt} />
        </span>

        <span className={styles.bottomLine}>
          <span>
            {conversation.lastMessage?.text ??
              (conversation.lastMessage ? "Atașament" : "Conversație nouă")}
          </span>

          {conversation.unreadCount > 0 && (
            <b aria-label={`${conversation.unreadCount} mesaje necitite`}>
              {conversation.unreadCount > 99
                ? "99+"
                : conversation.unreadCount}
            </b>
          )}
        </span>
      </span>
    </button>
  );
}
