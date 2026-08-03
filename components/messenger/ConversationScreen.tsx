"use client";

import { useRouter } from "next/navigation";
import ChatHeader from "./ChatHeader";
import Layout from "./Layout";

type ConversationScreenProps = {
  title?: string;
  subtitle?: string;
  avatarUrl?: string | null;
  initials?: string;
};

export default function ConversationScreen({
  title = "Friends Messenger",
  subtitle = "Offline",
  avatarUrl = null,
  initials = "F",
}: ConversationScreenProps) {
  const router = useRouter();

  return (
    <div className="friends-m2-screen">
      <Layout
        header={
          <ChatHeader
            title={title}
            subtitle={subtitle}
            avatarUrl={avatarUrl}
            initials={initials}
            onBack={() => router.push("/messages")}
          />
        }
        messages={
          <div className="friends-m2-empty-state">
            <strong>Messenger M2</strong>
            <span>Fundația noului ecran de conversație este activă.</span>
          </div>
        }
        composer={
          <div className="friends-m2-composer-preview">
            <input
              type="text"
              placeholder="Scrie un mesaj..."
              aria-label="Scrie un mesaj"
            />

            <button type="button" aria-label="Trimite mesajul">
              Trimite
            </button>
          </div>
        }
      />
    </div>
  );
}