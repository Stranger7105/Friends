"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { notifyNotificationCountsChanged } from "@/lib/notificationEvents";

type FriendRequest = {
  id: number;
  sender_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
};

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  city: string | null;
  country: string | null;
  avatar_url: string | null;
};

type RequestWithProfile = FriendRequest & {
  sender: Profile | null;
};

function getInitials(profile: Profile | null) {
  const value = profile?.full_name || profile?.username || "U";

  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function RequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<RequestWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadRequests() {
      setLoading(true);
      setMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const requestsResult = await supabase
        .from("friend_requests")
        .select("id, sender_id, receiver_id, status, created_at")
        .eq("receiver_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (requestsResult.error) {
        setMessage(`Nu am putut încărca cererile: ${requestsResult.error.message}`);
        setLoading(false);
        return;
      }

      const { error: readError } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("recipient_id", user.id)
        .eq("type", "friend_request")
        .eq("is_read", false);

      if (!readError) {
        notifyNotificationCountsChanged();
      }

      const requestRows = (requestsResult.data || []) as FriendRequest[];
      const senderIds = [...new Set(requestRows.map((request) => request.sender_id))];

      if (senderIds.length === 0) {
        setRequests([]);
        setLoading(false);
        return;
      }

      const profilesResult = await supabase
        .from("profiles")
        .select("id, username, full_name, city, country, avatar_url")
        .in("id", senderIds);

      if (profilesResult.error) {
        setMessage(
          `Cererile există, dar profilurile nu s-au încărcat: ${profilesResult.error.message}`
        );
        setLoading(false);
        return;
      }

      const profiles = (profilesResult.data || []) as Profile[];
      const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));

      setRequests(
        requestRows.map((request) => ({
          ...request,
          sender: profileMap.get(request.sender_id) || null,
        }))
      );

      setLoading(false);
    }

    loadRequests();
  }, [router]);

  async function respond(requestId: number, decision: "accepted" | "declined") {
    setProcessingId(requestId);
    setMessage("");

    const { error } = await supabase.rpc("respond_to_friend_request", {
      request_id: requestId,
      decision,
    });

    if (error) {
      setMessage(`Acțiunea nu a reușit: ${error.message}`);
      setProcessingId(null);
      return;
    }

    setRequests((current) =>
      current.filter((request) => request.id !== requestId)
    );

    setMessage(
      decision === "accepted"
        ? "Cererea a fost acceptată. Acum sunteți prieteni."
        : "Cererea a fost refuzată."
    );

    setProcessingId(null);
  }

  if (loading) {
    return (
      <main className="aurora-page min-h-screen px-4 py-8">
        <div className="mx-auto max-w-4xl rounded-2xl p-6 shadow" style={{ background: "var(--friends-surface)", color: "var(--friends-text)", border: "1px solid var(--friends-border)" }}>
          Se încarcă cererile...
        </div>
      </main>
    );
  }

  return (
    <main className="aurora-page min-h-screen px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-3xl font-bold" style={{ color: "var(--friends-text)" }}>
          Cereri de prietenie
        </h1>

        {message && (
          <div className="mb-5 rounded-xl border p-4" style={{ background: "var(--friends-surface)", color: "var(--friends-text)", borderColor: "var(--friends-border)" }}>
            {message}
          </div>
        )}

        {requests.length === 0 ? (
          <div className="rounded-2xl p-6 shadow" style={{ background: "var(--friends-surface)", color: "var(--friends-muted)", border: "1px solid var(--friends-border)" }}>
            Nu ai cereri de prietenie în așteptare.
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => {
              const profile = request.sender;
              const location = [profile?.city, profile?.country]
                .filter(Boolean)
                .join(", ");

              return (
                <article
                  key={request.id}
                  className="flex flex-col gap-4 rounded-2xl p-5 shadow sm:flex-row sm:items-center"
                  style={{ background: "var(--friends-surface)", color: "var(--friends-text)", border: "1px solid var(--friends-border)" }}
                >
                  <div className="flex flex-1 items-center gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-xl font-bold text-white"
                      style={{ background: "var(--friends-primary)" }}>
                      {profile?.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        getInitials(profile)
                      )}
                    </div>

                    <div>
                      <h2 className="text-lg font-bold" style={{ color: "var(--friends-text)" }}>
                        {profile?.full_name ||
                          profile?.username ||
                          "Utilizator"}
                      </h2>

                      {profile?.username && (
                        <p style={{ color: "var(--friends-muted)" }}>@{profile.username}</p>
                      )}

                      {location && (
                        <p className="mt-1 text-sm" style={{ color: "var(--friends-muted)" }}>
                          📍 {location}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => respond(request.id, "accepted")}
                      disabled={processingId === request.id}
                      className="rounded-lg px-5 py-2.5 font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
                      style={{ background: "var(--friends-primary)" }}
                    >
                      {processingId === request.id ? "Se procesează..." : "Acceptă"}
                    </button>

                    <button
                      type="button"
                      onClick={() => respond(request.id, "declined")}
                      disabled={processingId === request.id}
                      className="rounded-lg border px-5 py-2.5 font-semibold transition hover:-translate-y-0.5 disabled:opacity-60"
                      style={{ background: "var(--friends-surface-strong)", color: "var(--friends-text)", borderColor: "var(--friends-border)" }}
                    >
                      Refuză
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}