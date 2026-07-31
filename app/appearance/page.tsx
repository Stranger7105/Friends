"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  applyFriendsTheme,
  getFriendsTheme,
  type FriendsTheme,
} from "@/components/ThemeLoader";
import "@/styles/appearance.css";

type ThemeId = FriendsTheme;

const themes: Array<{
  id: ThemeId;
  name: string;
  description: string;
  className: string;
}> = [
  {
    id: "aurora",
    name: "Aurora Green",
    description: "Verde nordic și reflexii reci",
    className: "appearance-preview-aurora",
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Albastru marin și lumină rece",
    className: "appearance-preview-ocean",
  },
  {
    id: "purple",
    name: "Northern Purple",
    description: "Violet, roz și albastru nocturn",
    className: "appearance-preview-purple",
  },
  {
    id: "sunset",
    name: "Sunset",
    description: "Portocaliu cald și tonuri pastel",
    className: "appearance-preview-sunset",
  },
  {
    id: "space",
    name: "Deep Space",
    description: "Fundal întunecat și accente cosmice",
    className: "appearance-preview-space",
  },
  {
    id: "frozen",
    name: "Frozen",
    description: "Gheață luminoasă și albastru polar",
    className: "appearance-preview-frozen",
  },
  {
    id: "cherry-blossom",
    name: "Cherry Blossom",
    description: "Roz pastel, flori de cireș și lumină delicată",
    className: "appearance-preview-cherry",
  },
];

export default function AppearancePage() {
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>("aurora");
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    setSelectedTheme(getFriendsTheme());
  }, []);

  const selectedThemeData = useMemo(
    () => themes.find((theme) => theme.id === selectedTheme) ?? themes[0],
    [selectedTheme]
  );

  function selectTheme(themeId: ThemeId) {
    setSelectedTheme(themeId);
    applyFriendsTheme(themeId);
    setSavedMessage(`Tema ${themes.find((theme) => theme.id === themeId)?.name ?? ""} a fost aplicată.`);
  }

  function restoreDefault() {
    setSelectedTheme("aurora");
    applyFriendsTheme("aurora");
    setSavedMessage("Tema Aurora Green a fost restaurată.");
  }

  return (
    <main className="appearance-page">
      <div
        className="appearance-background-glow appearance-background-glow-one"
        aria-hidden="true"
      />
      <div
        className="appearance-background-glow appearance-background-glow-two"
        aria-hidden="true"
      />

      <section className="appearance-shell">
        <header className="appearance-header">
          <div>
            <span className="appearance-kicker">PERSONALIZARE FRIENDS</span>
            <h1>Aspect și teme</h1>
            <p>
              Alege stilul care îți place. Tema se aplică instant și este
              memorată în browser.
            </p>
          </div>

          <Link href="/feed" className="appearance-back-button">
            <span aria-hidden="true">←</span>
            Înapoi la feed
          </Link>
        </header>

        <section className="appearance-current-card">
          <div>
            <span className="appearance-section-label">TEMA ACTIVĂ</span>
            <h2>{selectedThemeData.name}</h2>
            <p>{selectedThemeData.description}</p>
          </div>

          <button
            type="button"
            onClick={restoreDefault}
            className="appearance-secondary-button"
          >
            Restabilește Aurora
          </button>
        </section>

        {savedMessage && (
          <div className="appearance-success-message" role="status">
            {savedMessage}
          </div>
        )}

        <section className="appearance-theme-grid" aria-label="Teme disponibile">
          {themes.map((theme) => {
            const selected = selectedTheme === theme.id;

            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => selectTheme(theme.id)}
                className={`appearance-theme-card ${
                  selected ? "appearance-theme-card-selected" : ""
                }`}
                aria-pressed={selected}
              >
                <div className={`appearance-theme-preview ${theme.className}`}>
                  <span className="appearance-preview-orb appearance-preview-orb-one" />
                  <span className="appearance-preview-orb appearance-preview-orb-two" />
                  <span className="appearance-preview-panel" />
                </div>

                <div className="appearance-theme-info">
                  <div>
                    <h2>{theme.name}</h2>
                    <p>{theme.description}</p>
                  </div>

                  <span className="appearance-theme-status">
                    {selected ? "Activă" : "Alege"}
                  </span>
                </div>
              </button>
            );
          })}
        </section>
      </section>
    </main>
  );
}
