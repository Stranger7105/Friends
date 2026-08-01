"use client";

import type { ReactNode } from "react";
import "@/styles/feed-layout-v4.css";

type FeedLayoutProps = {
  left: ReactNode;
  children: ReactNode;
  right: ReactNode;
};

export default function FeedLayout({
  left,
  children,
  right,
}: FeedLayoutProps) {
  return (
    <main className="friends-feed-v4" aria-label="Feed Friends">
      <aside className="friends-feed-v4-side friends-feed-v4-left" aria-label="Știri și meteo">
        {left}
      </aside>

      <section className="friends-feed-v4-center">
        {children}
      </section>

      <aside className="friends-feed-v4-side friends-feed-v4-right" aria-label="Hartă și prieteni online">
        {right}
      </aside>
    </main>
  );
}
