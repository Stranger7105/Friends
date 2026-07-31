import styles from "./Shared.module.css";

export default function OnlineBadge({ online }: { online: boolean }) {
  return (
    <span
      className={`${styles.onlineBadge} ${online ? styles.online : ""}`}
      aria-label={online ? "Online" : "Offline"}
      title={online ? "Online" : "Offline"}
    />
  );
}
