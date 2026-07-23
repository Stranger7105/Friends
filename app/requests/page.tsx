"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
        <div className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow">
          Se încarcă cererile...
        </div>
      </main>
    );
  }

  return (
    <main className="aurora-page min-h-screen px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-3xl font-bold text-gray-900">
          Cereri de prietenie
        </h1>

        {message && (
          <div className="mb-5 rounded-xl border bg-white p-4">
            {message}
          </div>
        )}

        {requests.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-gray-600 shadow">
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
                  className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow sm:flex-row sm:items-center"
                >
                  <div className="flex flex-1 items-center gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-600 text-xl font-bold text-white">
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
                      <h2 className="text-lg font-bold text-gray-900">
                        {profile?.full_name ||
                          profile?.username ||
                          "Utilizator"}
                      </h2>

                      {profile?.username && (
                        <p className="text-gray-500">@{profile.username}</p>
                      )}

                      {location && (
                        <p className="mt-1 text-sm text-gray-600">
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
                      className="rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                    >
                      {processingId === request.id ? "Se procesează..." : "Acceptă"}
                    </button>

                    <button
                      type="button"
                      onClick={() => respond(request.id, "declined")}
                      disabled={processingId === request.id}
                      className="rounded-lg border border-gray-300 px-5 py-2.5 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
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