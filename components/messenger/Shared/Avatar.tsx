import styles from "./Shared.module.css";

type AvatarProps = {
  src?: string | null;
  name?: string | null;
  size?: "sm" | "md" | "lg";
};

export default function Avatar({
  src,
  name,
  size = "md",
}: AvatarProps) {
  const initials =
    name
      ?.split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "F";

  return (
    <span className={`${styles.avatar} ${styles[size]}`} aria-label={name ?? "Profil"}>
      {src ? <img src={src} alt="" loading="lazy" /> : <span>{initials}</span>}
    </span>
  );
}
