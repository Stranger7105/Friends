"use client";

import Link from "next/link";

export default function AppearanceButton() {
  return (
    <Link
      href="/appearance"
      aria-label="Deschide setările de aspect"
      title="Aspect"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "44px",
        height: "44px",
        borderRadius: "14px",
        textDecoration: "none",
        fontSize: "22px",
        background: "rgba(255, 255, 255, 0.12)",
        border: "1px solid rgba(255, 255, 255, 0.2)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        transition: "transform 0.2s ease, background 0.2s ease",
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.transform = "scale(1.08)";
        event.currentTarget.style.background = "rgba(255, 255, 255, 0.18)";
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = "scale(1)";
        event.currentTarget.style.background = "rgba(255, 255, 255, 0.12)";
      }}
    >
      🎨
    </Link>
  );
}