"use client";

import Link from "next/link";

export default function SettingsPage() {
  return (
    <main className="aurora-page min-h-screen px-6 py-8">
      <div className="mx-auto max-w-5xl">

        <div
          className="rounded-3xl p-8 shadow-xl"
          style={{
            background: "var(--friends-surface)",
            border: "1px solid var(--friends-border)",
          }}
        >
          <h1
            className="text-4xl font-bold"
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

            <div
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
                🔔 Notificări
              </h2>

              <p
                className="mt-2"
                style={{ color: "var(--friends-muted)" }}
              >
                În curând.
              </p>
            </div>

            <div
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
            </div>

            <div
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
            </div>

          </div>
        </div>

      </div>
    </main>
  );
}