"use client";

import { ArrowLeft, Check, Search, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Friendship = {
  user_id: string;
  friend_id: string;
};

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
};

type CreateGroupResult = {
  group_id: number;
  conversation_id: number;
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

export default function CreateGroupPage() {
  const router = useRouter();
  const [friends, setFriends] = useState<Profile[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadFriends() {
      setLoading(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const friendshipsResult = await supabase
        .from("friends")
        .select("user_id, friend_id")
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

      if (friendshipsResult.error) {
        if (active) {
          setError(`Nu am putut încărca prietenii: ${friendshipsResult.error.message}`);
          setLoading(false);
        }
        return;
      }

      const friendships = (friendshipsResult.data || []) as Friendship[];
      const friendIds = [
        ...new Set(
          friendships.map((friendship) =>
            friendship.user_id === user.id ? friendship.friend_id : friendship.user_id,
          ),
        ),
      ];

      if (friendIds.length === 0) {
        if (active) {
          setFriends([]);
          setLoading(false);
        }
        return;
      }

      const profilesResult = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, city, country")
        .in("id", friendIds)
        .order("full_name", { ascending: true });

      if (!active) return;

      if (profilesResult.error) {
        setError(`Nu am putut încărca profilurile: ${profilesResult.error.message}`);
      } else {
        setFriends((profilesResult.data || []) as Profile[]);
      }

      setLoading(false);
    }

    void loadFriends();

    return () => {
      active = false;
    };
  }, [router]);

  const visibleFriends = useMemo(() => {
    const value = query.trim().toLocaleLowerCase("ro-RO");
    if (!value) return friends;

    return friends.filter((friend) => {
      const haystack = `${friend.full_name || ""} ${friend.username || ""} ${friend.city || ""} ${friend.country || ""}`
        .toLocaleLowerCase("ro-RO");
      return haystack.includes(value);
    });
  }, [friends, query]);

  function toggleFriend(friendId: string) {
    setSelectedIds((current) =>
      current.includes(friendId)
        ? current.filter((id) => id !== friendId)
        : [...current, friendId],
    );
  }

  async function createGroup() {
    const cleanName = name.trim();

    if (cleanName.length < 2) {
      setError("Numele grupului trebuie să aibă cel puțin 2 caractere.");
      return;
    }

    if (selectedIds.length < 2) {
      setError("Alege cel puțin doi prieteni pentru grup.");
      return;
    }

    setCreating(true);
    setError("");

    const { data, error: rpcError } = await supabase.rpc("create_friends_group", {
      group_name: cleanName,
      group_description: description.trim() || null,
      selected_member_ids: selectedIds,
    });

    if (rpcError) {
      setError(`Grupul nu a putut fi creat: ${rpcError.message}`);
      setCreating(false);
      return;
    }

    const result = Array.isArray(data)
      ? (data[0] as CreateGroupResult | undefined)
      : (data as CreateGroupResult | null);

    const groupId = Number(result?.group_id);

    if (!Number.isFinite(groupId) || groupId <= 0) {
      setError("Grupul a fost creat, dar ID-ul returnat nu este valid.");
      setCreating(false);
      return;
    }

    router.replace(`/groups/${groupId}`);
    router.refresh();
  }

  return (
    <main className="friends-groups-page">
      <section className="friends-groups-shell">
        <header className="friends-groups-header">
          <div>
            <span>GRUP NOU</span>
            <h1>Creează un grup</h1>
            <p>Alege cel puțin doi prieteni și construiește un spațiu comun în Friends.</p>
          </div>

          <Link href="/groups" className="friends-groups-create-button">
            <ArrowLeft size={19} /> Înapoi
          </Link>
        </header>

        {error && <div className="friends-groups-state is-error">{error}</div>}

        <section className="rounded-3xl border p-5 shadow-xl backdrop-blur md:p-7" style={{ background: "var(--friends-surface)", borderColor: "var(--friends-border)", color: "var(--friends-text)" }}>
          <div className="grid gap-5 md:grid-cols-2">
            <label className="grid gap-2 font-semibold">
              Numele grupului
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                placeholder="Exemplu: Familie"
                className="rounded-2xl border px-4 py-3 outline-none"
                style={{ background: "var(--friends-surface-strong)", borderColor: "var(--friends-border)", color: "var(--friends-text)" }}
              />
            </label>

            <label className="grid gap-2 font-semibold">
              Descriere opțională
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={500}
                placeholder="Despre ce este grupul?"
                className="rounded-2xl border px-4 py-3 outline-none"
                style={{ background: "var(--friends-surface-strong)", borderColor: "var(--friends-border)", color: "var(--friends-text)" }}
              />
            </label>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Alege membrii</h2>
              <p className="text-sm" style={{ color: "var(--friends-muted)" }}>
                Selectați: {selectedIds.length} · Total în grup cu tine: {selectedIds.length + 1}
              </p>
            </div>

            <label className="flex min-w-[260px] items-center gap-2 rounded-2xl border px-4 py-3" style={{ background: "var(--friends-surface-strong)", borderColor: "var(--friends-border)" }}>
              <Search size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Caută prieteni…"
                className="min-w-0 flex-1 bg-transparent outline-none"
              />
            </label>
          </div>

          {loading ? (
            <div className="friends-groups-state">Se încarcă prietenii…</div>
          ) : friends.length === 0 ? (
            <div className="friends-groups-state">Nu ai încă prieteni pe care să-i adaugi.</div>
          ) : (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {visibleFriends.map((friend) => {
                const selected = selectedIds.includes(friend.id);
                const location = [friend.city, friend.country].filter(Boolean).join(", ");

                return (
                  <button
                    key={friend.id}
                    type="button"
                    onClick={() => toggleFriend(friend.id)}
                    className="flex items-center gap-4 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
                    style={{
                      background: selected
                        ? "color-mix(in srgb, var(--friends-primary) 16%, var(--friends-surface))"
                        : "var(--friends-surface-strong)",
                      borderColor: selected ? "var(--friends-primary)" : "var(--friends-border)",
                    }}
                  >
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full font-black text-white" style={{ background: "var(--friends-primary)" }}>
                      {friend.avatar_url ? (
                        <img src={friend.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        getInitials(friend)
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <strong className="block truncate">{friend.full_name || friend.username || "Utilizator"}</strong>
                      {friend.username && <small className="block truncate" style={{ color: "var(--friends-muted)" }}>@{friend.username}</small>}
                      {location && <small className="block truncate" style={{ color: "var(--friends-muted)" }}>📍 {location}</small>}
                    </div>

                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border" style={{ background: selected ? "var(--friends-primary)" : "transparent", borderColor: selected ? "var(--friends-primary)" : "var(--friends-border)", color: selected ? "white" : "var(--friends-muted)" }}>
                      {selected ? <Check size={18} /> : <Users size={17} />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-7 flex justify-end">
            <button
              type="button"
              onClick={() => void createGroup()}
              disabled={creating || name.trim().length < 2 || selectedIds.length < 2}
              className="friends-groups-create-button is-large disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Users size={20} /> {creating ? "Se creează…" : "Creează grupul"}
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}
