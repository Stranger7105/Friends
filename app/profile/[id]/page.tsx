"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  AuroraAvatar,
  AuroraButton,
  AuroraCard,
  AuroraSection,
  AuroraStat,
} from "@/components/aurora";

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  bio: string | null;
  city: string | null;
  country: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  created_at: string;
};

type Post = {
  id: number;
  content: string;
  created_at: string;
};

type Friendship = {
  id: number;
  user_id: string;
  friend_id: string;
};

type FriendRequest = {
  id: number;
  sender_id: string;
  receiver_id: string;
  status: string;
};

type Relationship =
  | { kind: "friends"; friendship: Friendship }
  | { kind: "sent"; request: FriendRequest }
  | { kind: "received"; request: FriendRequest }
  | { kind: "none" };

function getInitials(profile: Profile | null) {
  const value = profile?.full_name || profile?.username || "U";

  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function formatMemberSince(date: string) {
  return new Intl.DateTimeFormat("ro-RO", {
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

export default function PublicProfilePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const profileId = params?.id;

  const [currentUserId, setCurrentUserId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [friendCount, setFriendCount] = useState(0);
  const [relationship, setRelationship] = useState<Relationship>({
    kind: "none",
  });
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  async function loadRelationship(userId: string, otherUserId: string) {
    const [friendshipResult, requestResult] = await Promise.all([
      supabase
        .from("friends")
        .select("id, user_id, friend_id")
        .or(
          `and(user_id.eq.${userId},friend_id.eq.${otherUserId}),and(user_id.eq.${otherUserId},friend_id.eq.${userId})`
        )
        .maybeSingle(),

      supabase
        .from("friend_requests")
        .select("id, sender_id, receiver_id, status")
        .eq("status", "pending")
        .or(
          `and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`
        )
        .maybeSingle(),
    ]);

    if (friendshipResult.data) {
      setRelationship({
        kind: "friends",
        friendship: friendshipResult.data as Friendship,
      });
      return;
    }

    const request = requestResult.data as FriendRequest | null;

    if (!request) {
      setRelationship({ kind: "none" });
      return;
    }

    setRelationship(
      request.sender_id === userId
        ? { kind: "sent", request }
        : { kind: "received", request }
    );
  }

  useEffect(() => {
    async function loadPublicProfile() {
      if (!profileId) return;

      setLoading(true);
      setMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setCurrentUserId(user.id);

      if (profileId === user.id) {
        router.replace("/profile");
        return;
      }

      const [profileResult, postsResult, friendshipsResult] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, username, full_name, bio, city, country, avatar_url, cover_url, created_at"
          )
          .eq("id", profileId)
          .single(),

        supabase
          .from("posts")
          .select("id, content, created_at")
          .eq("user_id", profileId)
          .order("created_at", { ascending: false }),

        supabase
          .from("friends")
          .select("id, user_id, friend_id")
          .or(`user_id.eq.${profileId},friend_id.eq.${profileId}`),
      ]);

      if (profileResult.error) {
        setMessage(`Profilul nu a putut fi încărcat: ${profileResult.error.message}`);
        setLoading(false);
        return;
      }

      setProfile(profileResult.data as Profile);
      setPosts((postsResult.data || []) as Post[]);

      if (!friendshipsResult.error) {
        setFriendCount(((friendshipsResult.data || []) as Friendship[]).length);
      }

      await loadRelationship(user.id, profileId);
      setLoading(false);
    }

    void loadPublicProfile();
  }, [profileId, router]);

  async function addFriend() {
    if (!currentUserId || !profileId) return;

    setWorking(true);
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
      setRelationship({ kind: "sent", request: data as FriendRequest });
      setMessage("Cererea de prietenie a fost trimisă.");
    }

    setWorking(false);
  }

  async function cancelRequest() {
    if (relationship.kind !== "sent") return;

    setWorking(true);
    setMessage("");

    const { error } = await supabase
      .from("friend_requests")
      .delete()
      .eq("id", relationship.request.id);

    if (error) {
      setMessage(`Cererea nu a putut fi anulată: ${error.message}`);
    } else {
      setRelationship({ kind: "none" });
      setMessage("Cererea de prietenie a fost anulată.");
    }

    setWorking(false);
  }

  async function acceptRequest() {
    if (relationship.kind !== "received") return;

    setWorking(true);
    setMessage("");

    const { error } = await supabase.rpc("respond_to_friend_request", {
      request_id: relationship.request.id,
      decision: "accepted",
    });

    if (error) {
      setMessage(`Cererea nu a putut fi acceptată: ${error.message}`);
    } else if (currentUserId && profileId) {
      await loadRelationship(currentUserId, profileId);
      setFriendCount((value) => value + 1);
      setMessage("Cererea a fost acceptată. Acum sunteți prieteni.");
    }

    setWorking(false);
  }

  async function removeFriend() {
    if (relationship.kind !== "friends") return;

    const confirmed = window.confirm(
      "Sigur vrei să elimini această persoană din lista de prieteni?"
    );

    if (!confirmed) return;

    setWorking(true);
    setMessage("");

    const { error } = await supabase
      .from("friends")
      .delete()
      .eq("id", relationship.friendship.id);

    if (error) {
      setMessage(`Prietenul nu a putut fi eliminat: ${error.message}`);
    } else {
      setRelationship({ kind: "none" });
      setFriendCount((value) => Math.max(0, value - 1));
      setMessage("Persoana a fost eliminată din lista de prieteni.");
    }

    setWorking(false);
  }

  async function openConversation() {
    if (!profileId) return;

    setWorking(true);
    setMessage("");

    const { data, error } = await supabase.rpc(
      "start_direct_conversation",
      { other_user_id: profileId }
    );

    if (error) {
      setMessage(`Conversația nu a putut fi deschisă: ${error.message}`);
      setWorking(false);
      return;
    }

    router.push(`/messages/${data}`);
  }

  const location = useMemo(
    () => [profile?.city, profile?.country].filter(Boolean).join(", "),
    [profile?.city, profile?.country]
  );

  if (loading) {
    return (
      <main className="aurora-page flex min-h-screen items-center justify-center p-6">
        <AuroraCard className="aurora-enter p-8">
          Se încarcă profilul...
        </AuroraCard>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="aurora-page flex min-h-screen items-center justify-center p-6">
        <AuroraCard className="aurora-enter max-w-xl p-8">
          <p className="font-semibold text-slate-900">
            Profilul nu a putut fi găsit.
          </p>
          {message && <p className="mt-3 text-rose-600">{message}</p>}
          <div className="mt-5">
            <Link href="/people">
              <AuroraButton type="button">Înapoi la persoane</AuroraButton>
            </Link>
          </div>
        </AuroraCard>
      </main>
    );
  }

  const initials = getInitials(profile);

  return (
    <main className="aurora-page pb-28 pt-6 sm:pt-10">
      <div className="aurora-enter mx-auto max-w-6xl px-4">
        <AuroraCard className="overflow-hidden">
          <div className="relative min-h-[300px] overflow-hidden p-6 sm:p-8">
            {profile.cover_url ? (
              <>
                <img
                  src={profile.cover_url}
                  alt="Copertă profil"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-emerald-950/65 to-lime-900/35" />
              </>
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.22),_transparent_28%),linear-gradient(120deg,#022c22_0%,#047857_48%,#65a30d_100%)]" />
            )}

            <div className="relative z-10 flex min-h-[250px] flex-col justify-end gap-6 sm:flex-row sm:items-end">
              <AuroraAvatar
                src={profile.avatar_url}
                initials={initials}
                size="xl"
              />

              <div className="flex-1 text-white">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="mb-2 text-sm font-semibold uppercase tracking-[0.24em] text-emerald-100/90">
                      Friends Aurora
                    </p>

                    <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
                      {profile.full_name || profile.username || "Utilizator"}
                    </h1>

                    {profile.username && (
                      <p className="mt-2 text-white/75">@{profile.username}</p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2 text-sm">
                      {location && (
                        <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur">
                          📍 {location}
                        </span>
                      )}

                      <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur">
                        ✨ Membru din {formatMemberSince(profile.created_at)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {relationship.kind === "none" && (
                      <button
                        type="button"
                        onClick={addFriend}
                        disabled={working}
                        className="rounded-xl bg-emerald-500 px-5 py-3 font-bold text-white transition hover:scale-105 hover:bg-emerald-400 disabled:opacity-60"
                      >
                        {working ? "Se trimite..." : "Adaugă prieten"}
                      </button>
                    )}

                    {relationship.kind === "sent" && (
                      <button
                        type="button"
                        onClick={cancelRequest}
                        disabled={working}
                        className="rounded-xl bg-amber-500 px-5 py-3 font-bold text-white transition hover:scale-105 hover:bg-amber-400 disabled:opacity-60"
                      >
                        {working ? "Se anulează..." : "Anulează cererea"}
                      </button>
                    )}

                    {relationship.kind === "received" && (
                      <button
                        type="button"
                        onClick={acceptRequest}
                        disabled={working}
                        className="rounded-xl bg-emerald-500 px-5 py-3 font-bold text-white transition hover:scale-105 hover:bg-emerald-400 disabled:opacity-60"
                      >
                        {working ? "Se acceptă..." : "Acceptă cererea"}
                      </button>
                    )}

                    {relationship.kind === "friends" && (
                      <>
                        <button
                          type="button"
                          onClick={openConversation}
                          disabled={working}
                          className="rounded-xl bg-white px-5 py-3 font-bold text-emerald-800 transition hover:scale-105 hover:bg-emerald-50 disabled:opacity-60"
                        >
                          Mesaj
                        </button>

                        <button
                          type="button"
                          onClick={removeFriend}
                          disabled={working}
                          className="rounded-xl border border-white/30 bg-white/10 px-5 py-3 font-bold text-white backdrop-blur transition hover:scale-105 hover:bg-rose-500/80 disabled:opacity-60"
                        >
                          Elimină prieten
                        </button>
                      </>
                    )}

                    <Link href="/people">
                      <AuroraButton type="button" variant="ghost">
                        Persoane
                      </AuroraButton>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AuroraCard>

        {message && (
          <AuroraCard className="mt-5 p-4 text-sm font-medium text-slate-700">
            {message}
          </AuroraCard>
        )}

        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <AuroraStat value={posts.length} label="Postări" icon="📝" />
          <AuroraStat value={friendCount} label="Prieteni" icon="🤝" />
          <AuroraStat value={profile.avatar_url ? 1 : 0} label="Fotografii" icon="🖼️" />
          <AuroraStat
            value={
              relationship.kind === "friends"
                ? "Prieteni"
                : relationship.kind === "sent"
                ? "În așteptare"
                : relationship.kind === "received"
                ? "Cerere primită"
                : "Public"
            }
            label="Relație"
            icon="✨"
          />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
          <AuroraSection title="Despre">
            {profile.bio ? (
              <p className="whitespace-pre-wrap leading-7 text-slate-700">
                {profile.bio}
              </p>
            ) : (
              <p className="text-slate-500">
                Utilizatorul nu a adăugat încă o biografie.
              </p>
            )}

            <div className="mt-5 space-y-3 text-sm text-slate-600">
              {location && (
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  📍 {location}
                </div>
              )}

              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                🗓️ Membru din {formatMemberSince(profile.created_at)}
              </div>
            </div>
          </AuroraSection>

          <div>
            <div className="mb-4">
              <h2 className="text-2xl font-black tracking-tight text-slate-900">
                Activitate
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Cele mai recente postări publicate.
              </p>
            </div>

            {posts.length === 0 ? (
              <AuroraCard className="p-6 text-slate-600">
                Acest utilizator nu a publicat încă nicio postare.
              </AuroraCard>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
                  <AuroraCard key={post.id} interactive className="p-5 sm:p-6">
                    <div className="mb-4 flex items-center gap-3">
                      <AuroraAvatar
                        src={profile.avatar_url}
                        initials={initials}
                        size="sm"
                      />

                      <div>
                        <p className="font-bold text-slate-900">
                          {profile.full_name ||
                            profile.username ||
                            "Utilizator"}
                        </p>
                        <p className="text-sm text-slate-500">
                          {new Date(post.created_at).toLocaleString("ro-RO")}
                        </p>
                      </div>
                    </div>

                    <p className="whitespace-pre-wrap leading-7 text-slate-800">
                      {post.content}
                    </p>
                  </AuroraCard>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
