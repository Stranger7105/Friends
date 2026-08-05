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
        gridTemplateRows: "72px minmax(0, 1fr) auto",
        height: "calc(100dvh - 128px)",
        minHeight: 0,
        overflow: "hidden",
        background: "#10131a",
        color: "#ffffff",
      }}
    >
      {header}

      <section
        style={{
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          padding: 16,
        }}
      >
        {messages}
      </section>

      {composer}
    </main>
  );
}
