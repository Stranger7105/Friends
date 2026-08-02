"use client";

import Link from "next/link";
import { ArrowLeft, MapPinned } from "lucide-react";
import FriendsLocationMap from "@/components/feed/FriendsLocationMap";
import "@/styles/friends-map-page.css";

export default function MapPage() {
  return (
    <main className="friends-map-page">
      <header className="friends-map-page-header">
        <Link
          href="/feed"
          className="friends-map-back-button"
          aria-label="Înapoi la feed"
          title="Înapoi"
        >
          <ArrowLeft size={22} />
        </Link>

        <div className="friends-map-page-title">
          <span className="friends-map-page-icon" aria-hidden="true">
            <MapPinned size={21} />
          </span>

          <div>
            <span>FRIENDS</span>
            <h1>Harta prietenilor</h1>
          </div>
        </div>
      </header>

      <section className="friends-map-page-content">
        <FriendsLocationMap />
      </section>
    </main>
  );
}
