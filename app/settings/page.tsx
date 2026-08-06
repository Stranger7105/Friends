"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";
import useMessageSound from "@/components/messenger-m3/hooks/useMessageSound";

export default function SettingsPage() {
  const [userId, setUserId] = useState("");
  const {
    soundEnabled,
    soundPreferenceReady,
    setSoundEnabled,
  } = useMessageSound(userId);

  useEffect(() => {
    let active = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (active && data.user) {
        setUserId(data.user.id);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="aurora-page min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div
          className="rounded-3xl p-5 shadow-xl sm:p-8"
          style={{
            background: "var(--friends-surface)",
            border: "1px solid var(--friends-border)",
          }}
        >
          <h1
            className="text-3xl font-bold sm:text-4xl"
            style={{ color: "var(--friends-text)" }}
          >
            ⚙️ Setări
          </h1>

          <p
            className="mt-3"
            style={{ color: "var(--friends-muted)" }}
          >
            Personalizează Friends după preferințele tale.
          </p>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <Link
              href="/appearance"
              className="rounded-2xl p-6 transition hover:scale-[1.02]"
              style={{
                background: "var(--friends-surface-strong)",
                border: "1px solid var(--friends-border)",
              }}
            >
              <h2
                className="text-xl font-bold"
                style={{ color: "var(--friends-text)" }}
              >
                🎨 Aspect
              </h2>
              <p
                className="mt-2"
                style={{ color: "var(--friends-muted)" }}
              >
                Alege tema Friends și personalizează culorile aplicației.
              </p>
            </Link>

            <section
              className="rounded-2xl p-6"
              style={{
                background: "var(--friends-surface-strong)",
                border: "1px solid var(--friends-border)",
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2
                    className="text-xl font-bold"
                    style={{ color: "var(--friends-text)" }}
                  >
                    🔔 Notificări
                  </h2>
                  <p
                    className="mt-2 text-sm"
                    style={{ color: "var(--friends-muted)" }}
                  >
                    Alege dacă dorești să fii anunțat sonor când primești un mesaj nou.
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={soundEnabled}
                  disabled={
                    !userId || !soundPreferenceReady
                  }
                  onClick={() =>
                    void setSoundEnabled(!soundEnabled)
                  }
                  aria-label={
                    soundEnabled
                      ? "Dezactivează sunetul mesajelor"
                      : "Activează sunetul mesajelor"
                  }
                  style={{
                    position: "relative",
                    width: 56,
                    minWidth: 56,
                    height: 32,
                    padding: 0,
                    flexShrink: 0,
                    overflow: "hidden",
                    border: 0,
                    borderRadius: 999,
                    background: soundEnabled
                      ? "var(--friends-primary)"
                      : "rgba(148,163,184,0.38)",
                    opacity:
                      userId && soundPreferenceReady
                        ? 1
                        : 0.55,
                    cursor:
                      userId && soundPreferenceReady
                        ? "pointer"
                        : "default",
                    transition:
                      "background 160ms ease, opacity 160ms ease",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      top: 4,
                      left: soundEnabled ? 28 : 4,
                      width: 24,
                      height: 24,
                      display: "block",
                      borderRadius: "50%",
                      background: "#ffffff",
                      boxShadow:
                        "0 2px 7px rgba(0,0,0,0.28)",
                      transition: "left 160ms ease",
                    }}
                  />
                </button>
              </div>

              <div
                className="mt-5 flex items-center justify-between rounded-xl p-4"
                style={{
                  background: "var(--friends-surface)",
                  border: "1px solid var(--friends-border)",
                }}
              >
                <div>
                  <p
                    className="font-semibold"
                    style={{ color: "var(--friends-text)" }}
                  >
                    Sunet la mesaj nou
                  </p>
                  <p
                    className="mt-1 text-sm"
                    style={{ color: "var(--friends-muted)" }}
                  >
                    {soundEnabled
                      ? "Activat. Vei auzi un sunet discret."
                      : "Dezactivat. Mesajele vor rămâne silențioase."}
                  </p>
                </div>
                <span className="text-2xl">
                  {soundEnabled ? "🔔" : "🔕"}
                </span>
              </div>

              <button
                type="button"
                disabled={
                  !userId || !soundPreferenceReady
                }
                onClick={() => void setSoundEnabled(true)}
                className="mt-4 rounded-xl px-4 py-2.5 font-semibold text-white disabled:opacity-50"
                style={{
                  background: "var(--friends-primary)",
                }}
              >
                Testează sunetul
              </button>
            </section>

            <section
              className="rounded-2xl p-6"
              style={{
                background: "var(--friends-surface-strong)",
                border: "1px solid var(--friends-border)",
              }}
            >
              <h2
                className="text-xl font-bold"
                style={{ color: "var(--friends-text)" }}
              >
                🔒 Confidențialitate
              </h2>
              <p
                className="mt-2"
                style={{ color: "var(--friends-muted)" }}
              >
                În curând.
              </p>
            </section>

            <section
              className="rounded-2xl p-6"
              style={{
                background: "var(--friends-surface-strong)",
                border: "1px solid var(--friends-border)",
              }}
            >
              <h2
                className="text-xl font-bold"
                style={{ color: "var(--friends-text)" }}
              >
                👤 Cont
              </h2>
              <p
                className="mt-2"
                style={{ color: "var(--friends-muted)" }}
              >
                În curând.
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
