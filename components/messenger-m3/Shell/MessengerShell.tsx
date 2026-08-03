"use client";

import type { ReactNode } from "react";

type MessengerShellProps = {
  header: ReactNode;
  messages: ReactNode;
  composer: ReactNode;
};

export default function MessengerShell({
  header,
  messages,
  composer,
}: MessengerShellProps) {
  return (
    <main
      style={{
        display: "grid",
        gridTemplateRows: "72px minmax(0, 1fr) 80px",
        height: "calc(100dvh - 128px)",
        minHeight: 0,
        overflow: "hidden",
        background: "#10131a",
        color: "#fff",
      }}
    >
      {header}

      <section
        style={{
          minHeight: 0,
          overflowY: "auto",
          padding: 16,
        }}
      >
        {messages}
      </section>

      {composer}
    </main>
  );
}