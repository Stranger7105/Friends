"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import "@/styles/friends-landing.css";

export default function HomePage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;

      if (session?.user) {
        router.replace("/feed");
        return;
      }

      setCheckingSession(false);
    }

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        router.replace("/feed");
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  if (checkingSession) {
    return (
      <main className="friends-entry-page">
        <section className="friends-entry-card friends-entry-loading">
          <div className="friends-entry-logo" aria-hidden="true">
            <span />
          </div>
          <strong>Friends</strong>
          <p>Se verifică sesiunea...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="friends-entry-page">
      <section className="friends-entry-card">
        <div className="friends-entry-brand">
          <div className="friends-entry-logo" aria-hidden="true">
            <span />
          </div>

          <div>
            <span className="friends-entry-kicker">FRIENDS BETA</span>
            <h1>Friends</h1>
          </div>
        </div>

        <div className="friends-entry-copy">
          <h2>Mai aproape de oamenii care contează.</h2>
          <p>
            Distribuie momente, vorbește în timp real și păstrează legătura
            cu prietenii tăi într-un singur loc.
          </p>
        </div>

        <div className="friends-entry-actions">
          <Link href="/login" className="friends-entry-primary">
            Intră în cont
          </Link>

          <Link href="/register" className="friends-entry-secondary">
            Creează cont
          </Link>
        </div>

        <div className="friends-entry-features" aria-label="Funcții Friends">
          <span>Stories</span>
          <span>Reels</span>
          <span>Mesaje</span>
          <span>Apeluri</span>
        </div>

        <p className="friends-entry-note">
          Friends este în versiune Beta. Accesul este destinat momentan
          testării împreună cu prietenii.
        </p>
      </section>
    </main>
  );
}
