"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Friendship = {
  id: number;
  user_id: string;
  friend_id: string;
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

function getInitials(profile: Profile) {
  const value = profile.full_name || profile.username || "U";

  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function FriendsPage() {
  const router = useRouter();

  const [friends, setFriends] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadFriends() {
      setLoading(true);
      setMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const friendshipsResult = await supabase
        .from("friends")
        .select("id, user_id, friend_id, created_at")
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (friendshipsResult.error) {
        setMessage(
          `Nu am putut încărca prieteniile: ${friendshipsResult.error.message}`
        );
        setLoading(false);
        return;
      }

      const friendships = (friendshipsResult.data || []) as Friendship[];

      const friendIds = friendships.map((friendship) =>
        friendship.user_id === user.id
          ? friendship.friend_id
          : friendship.user_id
      );

      if (friendIds.length === 0) {
        setFriends([]);
        setLoading(false);
        return;
      }

      const profilesResult = await supabase
        .from("profiles")
        .select("id, username, full_name, city, country, avatar_url")
        .in("id", friendIds);

      if (profilesResult.error) {
        setMessage(
          `Nu am putut încărca profilurile: ${profilesResult.error.message}`
        );
        setLoading(false);
        return;
      }

      setFriends((profilesResult.data || []) as Profile[]);
      setLoading(false);
    }

    loadFriends();
  }, [router]);

  if (loading) {
    return (
      <main className="aurora-page min-h-screen px-4 py-8">
        <div className="mx-auto max-w-4xl rounded-2xl p-6 shadow" style={{ background: "var(--friends-surface)", color: "var(--friends-text)", border: "1px solid var(--friends-border)" }}>
          Se încarcă prietenii...
        </div>
      </main>
    );
  }

  return (
    <main className="aurora-page min-h-screen px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold" style={{ color: "var(--friends-text)" }}>Prietenii mei</h1>

          <button
            type="button"
            onClick={() => router.push("/people")}
            className="rounded-lg px-5 py-2.5 font-semibold text-white transition hover:-translate-y-0.5"
            style={{ background: "var(--friends-primary)" }}
          >
            Găsește prieteni
          </button>
        </div>

        {message && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {message}
          </div>
        )}

        {friends.length === 0 ? (
          <div className="rounded-2xl p-6 shadow" style={{ background: "var(--friends-surface)", color: "var(--friends-muted)", border: "1px solid var(--friends-border)" }}>
            Nu ai încă prieteni.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {friends.map((friend) => {
              const location = [friend.city, friend.country]
                .filter(Boolean)
                .join(", ");

              return (
                <article
                  key={friend.id}
                  className="flex items-center gap-4 rounded-2xl p-5 shadow"
                  style={{ background: "var(--friends-surface)", color: "var(--friends-text)", border: "1px solid var(--friends-border)" }}
                >
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-xl font-bold text-white"
                    style={{ background: "var(--friends-primary)" }}>
                    {friend.avatar_url ? (
                      <img
                        src={friend.avatar_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      getInitials(friend)
                    )}
                  </div>

                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold"
                      style={{ color: "var(--friends-text)" }}>
                      {friend.full_name || friend.username || "Utilizator"}
                    </h2>

                    {friend.username && (
                      <p className="truncate" style={{ color: "var(--friends-muted)" }}>
                        @{friend.username}
                      </p>
                    )}

                    {location && (
                      <p className="mt-1 truncate text-sm" style={{ color: "var(--friends-muted)" }}>
                        📍 {location}
                      </p>
                    )}
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