"use client";

import { Expand, Newspaper, Settings2, X } from "lucide-react";
import { useEffect, useState } from "react";

const DEFAULT_TOPICS = ["Tehnologie", "Sport", "Auto", "Știință"];

export default function PersonalizedNewsCard() {
  const [fullscreen, setFullscreen] = useState(false);
  const [topics] = useState(DEFAULT_TOPICS);

  useEffect(() => {
    if (!fullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", close);
    };
  }, [fullscreen]);

  const content = (
    <section className={`friends-dashboard-card friends-news-card ${fullscreen ? "is-fullscreen" : ""}`}>
      <header className="friends-dashboard-card-head">
        <div>
          <span>PERSONALIZAT</span>
          <h3><Newspaper size={19} /> Știri pentru tine</h3>
        </div>
        <button type="button" onClick={() => setFullscreen((value) => !value)} aria-label={fullscreen ? "Închide" : "Deschide pe tot ecranul"}>
          {fullscreen ? <X size={18} /> : <Expand size={18} />}
        </button>
      </header>

      <div className="friends-news-topics" aria-label="Subiecte preferate">
        {topics.map((topic) => <span key={topic}>{topic}</span>)}
      </div>

      <div className="friends-news-placeholder">
        <Newspaper size={28} />
        <strong>Fluxul de știri este pregătit</strong>
        <p>În pasul următor conectăm sursele și preferințele fiecărui utilizator.</p>
      </div>

      <button type="button" className="friends-card-secondary-action">
        <Settings2 size={16} /> Alege subiectele
      </button>
    </section>
  );

  return fullscreen ? <div className="friends-dashboard-modal">{content}</div> : content;
}
