"use client";

import Link from "next/link";
import { ArrowLeft, MapPinned } from "lucide-react";
import FriendsLocationMap from "@/components/feed/FriendsLocationMap";

export default function MapPage() {
  return (
    <main
      className="aurora-page"
      style={{
        minHeight: "100dvh",
        padding:
          "max(12px, env(safe-area-inset-top)) 12px calc(86px + env(safe-area-inset-bottom))",
      }}
    >
      <div
        style={{
          width: "min(1100px, 100%)",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <MapPinned size={25} />
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 24,
                  fontWeight: 850,
                }}
              >
                Harta Friends
              </h1>
              <p
                style={{
                  margin: "3px 0 0",
                  fontSize: 13,
                  opacity: 0.72,
                }}
              >
                Vezi prietenii care au ales să își afișeze locația.
              </p>
            </div>
          </div>

          <Link
            href="/feed"
            aria-label="Înapoi la Feed"
            title="Înapoi"
            style={{
              width: 42,
              height: 42,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              borderRadius: 14,
              border:
                "1px solid var(--friends-border, rgba(255,255,255,0.16))",
              background:
                "var(--friends-surface, rgba(255,255,255,0.08))",
              color: "inherit",
              textDecoration: "none",
            }}
          >
            <ArrowLeft size={21} />
          </Link>
        </div>

        <FriendsLocationMap />
      </div>
    </main>
  );
}
