"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  city: string | null;
  country: string | null;
  avatar_url: string | null;
};

type FriendRequest = {
  id: number;
  sender_id: string;
  receiver_id: string;
  status: string;
};

type Friendship = {
  id: number;
  user_id: string;
  friend_id: string;
};

function getInitials(profile: Profile) {
  const value = profile.full_name || profile.username || "U";

  return value.trim().split(/\s+/).slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase()).join("");
}

export default function PeoplePage() {
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadPeople() {
      setLoading(true);
      setMessage("");

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setCurrentUserId(user.id);

      const [profilesResult, requestsResult, friendshipsResult] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, username, full_name, city, country, avatar_url")
            .neq("id", user.id)
            .order("full_name", { ascending: true }),

          supabase
            .from("friend_requests")
            .select("id, sender_id, receiver_id, status")
            .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`),

          supabase
            .from("friends")
            .select("id, user_id, friend_id")
            .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`),
        ]);

      setProfiles((profilesResult.data || []) as Profile[]);
      setRequests((requestsResult.data || []) as FriendRequest[]);
      setFriendships((friendshipsResult.data || []) as Friendship[]);

      if (profilesResult.error || requestsResult.error || friendshipsResult.error) {
        setMessage(
          profilesResult.error?.message ||
          requestsResult.error?.message ||
          friendshipsResult.error?.message ||
          "Datele nu s-au putut încărca."
        );
      }

      setLoading(false);
    }

    void loadPeople();
  }, [router]);

  const visibleProfiles = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return profiles;

    return profiles.filter((profile) =>
      (profile.full_name || "").toLowerCase().includes(value) ||
      (profile.username || "").toLowerCase().includes(value)
    );
  }, [profiles, search]);

  function pendingRequest(profileId: string) {
    return requests.find((request) =>
      request.status === "pending" &&
      (
        (request.sender_id === currentUserId && request.receiver_id === profileId) ||
        (request.receiver_id === currentUserId && request.sender_id === profileId)
      )
    );
  }

  function friendship(profileId: string) {
    return friendships.find((item) =>
      (item.user_id === currentUserId && item.friend_id === profileId) ||
      (item.friend_id === currentUserId && item.user_id === profileId)
    );
  }

  async function addFriend(profileId: string) {
    setWorkingId(profileId);
    setMessage("");

    const { data, error } = await supabase
      .from("friend_requests")
      .insert({
        sender_id: currentUserId,
        receiver_id: profileId,
        status: "pending",
      })
      .select("id, sender_id, receiver_id, status")
      .single();

    if (error) {
      setMessage(`Cererea nu a putut fi trimisă: ${error.message}`);
    } else {
      setRequests((current) => [...current, data as FriendRequest]);
      setMessage("Cererea de prietenie a fost trimisă.");
    }

    setWorkingId(null);
  }

  async function cancelRequest(request: FriendRequest, profileId: string) {
    setWorkingId(profileId);
    setMessage("");

    const { error } = await supabase
      .from("friend_requests")
      .delete()
      .eq("id", request.id);

    if (error) {
      setMessage(`Cererea nu a putut fi anulată: ${error.message}`);
    } else {
      setRequests((current) => current.filter((item) => item.id !== request.id));
      setMessage("Cererea a fost anulată.");
    }

    setWorkingId(null);
  }

  async function acceptRequest(request: FriendRequest, profileId: string) {
    setWorkingId(profileId);
    setMessage("");

    const { error } = await supabase.rpc("respond_to_friend_request", {
      request_id: request.id,
      decision: "accepted",
    });

    if (error) {
      setMessage(`Cererea nu a putut fi acceptată: ${error.message}`);
    } else {
      setRequests((current) => current.filter((item) => item.id !== request.id));

      const friendshipsResult = await supabase
        .from("friends")
        .select("id, user_id, friend_id")
        .or(`user_id.eq.${currentUserId},friend_id.eq.${currentUserId}`);

      setFriendships((friendshipsResult.data || []) as Friendship[]);
      setMessage("Cererea a fost acceptată.");
    }

    setWorkingId(null);
  }

  async function removeFriend(item: Friendship, profileId: string) {
    if (!window.confirm("Sigur vrei să elimini această persoană?")) return;

    setWorkingId(profileId);
    setMessage("");

    const { error } = await supabase.from("friends").delete().eq("id", item.id);

    if (error) {
      setMessage(`Prietenul nu a putut fi eliminat: ${error.message}`);
    } else {
      setFriendships((current) => current.filter((row) => row.id !== item.id));
      setMessage("Persoana a fost eliminată din lista de prieteni.");
    }

    setWorkingId(null);
  }

  async function openConversation(profileId: string) {
    setWorkingId(profileId);
    setMessage("");

    const { data, error } = await supabase.rpc(
      "start_direct_conversation",
      { other_user_id: profileId }
    );

    if (error) {
      setMessage(`Conversația nu a putut fi deschisă: ${error.message}`);
      setWorkingId(null);
      return;
    }

    router.push(`/messages/${data}`);
  }

  if (loading) {
    return (
      <main className="aurora-page min-h-screen px-4 py-8">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow">
          Se încarcă utilizatorii...
        </div>
      </main>
    );
  }

  return (
    <main className="aurora-page min-h-screen px-4 py-8 pb-28">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-3xl font-bold text-gray-900">
          Găsește prieteni
        </h1>

        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Caută după nume sau username..."
          className="mb-5 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-emerald-400"
        />

        {message && (
          <div className="mb-5 rounded-xl border bg-white p-4">{message}</div>
        )}

        <div className="space-y-4">
          {visibleProfiles.map((profile) => {
            const request = pendingRequest(profile.id);
            const friend = friendship(profile.id);
            const received = request?.receiver_id === currentUserId;
            const busy = workingId === profile.id;

            return (
              <article
                key={profile.id}
                className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow transition hover:-translate-y-1 hover:shadow-xl sm:flex-row sm:items-center"
              >
                <div className="flex flex-1 items-center gap-4">
                  <Link href={`/profile/${profile.id}`} className="group shrink-0">
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-emerald-600 text-xl font-bold text-white transition group-hover:scale-110">
                      {profile.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : getInitials(profile)}
                    </div>
                  </Link>

                  <div>
                    <Link href={`/profile/${profile.id}`} className="group">
                      <h2 className="text-lg font-bold text-gray-900 group-hover:text-emerald-600">
                        {profile.full_name || profile.username || "Utilizator"}
                      </h2>
                      {profile.username && <p className="text-gray-500">@{profile.username}</p>}
                    </Link>

                    {(profile.city || profile.country) && (
                      <p className="mt-1 text-sm text-gray-600">
                        📍 {[profile.city, profile.country].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/profile/${profile.id}`}
                    className="rounded-lg border border-emerald-300 px-4 py-2 font-semibold text-emerald-700 hover:bg-emerald-50"
                  >
                    Profil
                  </Link>

                  {friend ? (
                    <>
                      <button
                        type="button"
                        onClick={() => openConversation(profile.id)}
                        disabled={busy}
                        className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                      >
                        Mesaj
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFriend(friend, profile.id)}
                        disabled={busy}
                        className="rounded-lg bg-rose-100 px-4 py-2 font-semibold text-rose-700 hover:bg-rose-200 disabled:opacity-60"
                      >
                        Elimină
                      </button>
                    </>
                  ) : request && received ? (
                    <button
                      type="button"
                      onClick={() => acceptRequest(request, profile.id)}
                      disabled={busy}
                      className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                    >
                      Acceptă
                    </button>
                  ) : request ? (
                    <button
                      type="button"
                      onClick={() => cancelRequest(request, profile.id)}
                      disabled={busy}
                      className="rounded-lg bg-amber-100 px-4 py-2 font-semibold text-amber-700 hover:bg-amber-200 disabled:opacity-60"
                    >
                      Anulează cererea
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => addFriend(profile.id)}
                      disabled={busy}
                      className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                    >
                      Adaugă prieten
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
