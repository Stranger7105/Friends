"use client";

import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ReelFeed from "./ReelFeed";
import UploadReelModal from "./UploadReelModal";
import { supabase } from "@/lib/supabase";
import "@/styles/reels.css";

export default function ReelsPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (!user) {
        router.replace("/login");
        return;
      }

      setCheckingSession(false);
    }

    void checkSession();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (checkingSession) {
    return (
      <main className="reels-page">
        <div className="reels-page-glow" aria-hidden="true" />
        <div className="reels-loading-card">
          <span className="reels-spinner" />
          <strong>Pregătim Reels...</strong>
        </div>
      </main>
    );
  }

  return (
    <main className="reels-page">
      <div className="reels-page-glow" aria-hidden="true" />

      <header className="reels-topbar">
        <div>
          <span className="reels-eyebrow">FRIENDS • AURORA</span>
          <h1>Reels</h1>
        </div>

        <div className="reels-topbar-actions">
          <div className="reels-tabs" aria-label="Filtru Reels">
            <button type="button" className="is-active">
              Pentru tine
            </button>
            <button type="button" disabled title="Disponibil în pachetul următor">
              Prieteni
            </button>
          </div>

          <button
            type="button"
            className="reels-create-button"
            onClick={() => setUploadOpen(true)}
          >
            <Plus />
            <span>Reel nou</span>
          </button>
        </div>
      </header>

      <ReelFeed refreshKey={refreshKey} />

      <UploadReelModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onPublished={() => {
          setUploadOpen(false);
          setRefreshKey((current) => current + 1);
        }}
      />
    </main>
  );
}