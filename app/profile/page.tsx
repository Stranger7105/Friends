"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  AuroraAvatar,
  AuroraButton,
  AuroraCard,
  AuroraInput,
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

function getInitials(profile: Profile | null) {
  const value = profile?.full_name || profile?.username || "U";
  return value.trim().split(/\s+/).slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase()).join("");
}

function cleanFileName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]/g, "-");
}

function formatMemberSince(date: string) {
  return new Intl.DateTimeFormat("ro-RO", {
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

export default function ProfilePage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setMessage("");

      const { data: { user: currentUser } } = await supabase.auth.getUser();

      if (!currentUser) {
        router.replace("/login");
        return;
      }

      const profileResult = await supabase
        .from("profiles")
        .select("id, username, full_name, bio, city, country, avatar_url, cover_url, created_at")
        .eq("id", currentUser.id)
        .single();

      if (profileResult.error) {
        setMessage(profileResult.error.message);
        setLoading(false);
        return;
      }

      const loadedProfile = profileResult.data as Profile;

      const postsResult = await supabase
        .from("posts")
        .select("id, content, created_at")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false });

      setUser(currentUser);
      setProfile(loadedProfile);
      setPosts((postsResult.data || []) as Post[]);

      setFullName(loadedProfile.full_name || "");
      setUsername(loadedProfile.username || "");
      setBio(loadedProfile.bio || "");
      setCity(loadedProfile.city || "");
      setCountry(loadedProfile.country || "");

      if (postsResult.error) setMessage(postsResult.error.message);
      setLoading(false);
    }

    loadProfile();
  }, [router]);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [avatarPreview, coverPreview]);

  function selectAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(file ? URL.createObjectURL(file) : null);
  }

  function selectCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(file ? URL.createObjectURL(file) : null);
  }

  async function uploadImage(bucket: "avatars" | "covers", file: File) {
    if (!user) throw new Error("Nu ești autentificat.");
    if (!file.type.startsWith("image/")) throw new Error("Fișierul selectat nu este o imagine.");
    if (file.size > 5 * 1024 * 1024) throw new Error("Imaginea trebuie să fie mai mică de 5 MB.");

    const path = `${user.id}/${Date.now()}-${cleanFileName(file.name)}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) throw error;

    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !profile) return;

    const finalUsername = username.trim().toLowerCase();

    if (!/^[a-z0-9_]{3,30}$/.test(finalUsername)) {
      setMessage("Username-ul trebuie să aibă 3–30 caractere: litere mici, cifre sau _.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      let avatarUrl = profile.avatar_url;
      let coverUrl = profile.cover_url;

      if (avatarFile) avatarUrl = await uploadImage("avatars", avatarFile);
      if (coverFile) coverUrl = await uploadImage("covers", coverFile);

      const { data, error } = await supabase
        .from("profiles")
        .update({
          username: finalUsername,
          full_name: fullName.trim() || null,
          bio: bio.trim() || null,
          city: city.trim() || null,
          country: country.trim() || null,
          avatar_url: avatarUrl,
          cover_url: coverUrl,
        })
        .eq("id", user.id)
        .select("id, username, full_name, bio, city, country, avatar_url, cover_url, created_at")
        .single();

      if (error) throw error;

      setProfile(data as Profile);
      setAvatarFile(null);
      setCoverFile(null);
      setAvatarPreview(null);
      setCoverPreview(null);
      setEditing(false);
      setMessage("Profilul a fost salvat.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Profilul nu a putut fi salvat.");
    } finally {
      setSaving(false);
    }
  }

  const avatar = avatarPreview || profile?.avatar_url || null;
  const cover = coverPreview || profile?.cover_url || null;

  const location = useMemo(
    () => [profile?.city, profile?.country].filter(Boolean).join(", "),
    [profile?.city, profile?.country]
  );

  if (loading) {
    return (
      <main className="aurora-page flex min-h-screen items-center justify-center p-6">
        <AuroraCard className="aurora-enter p-8">Se încarcă profilul...</AuroraCard>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="aurora-page flex min-h-screen items-center justify-center p-6">
        <AuroraCard className="aurora-enter max-w-xl p-8">
          <p className="font-semibold text-slate-900">Profilul nu a putut fi încărcat.</p>
          {message && <p className="mt-3 text-rose-600">{message}</p>}
        </AuroraCard>
      </main>
    );
  }

  const initials = getInitials(profile);

  return (
    <main className="aurora-page pb-16 pt-6 sm:pt-10">
      <div className="aurora-enter mx-auto max-w-6xl px-4">
        <AuroraCard className="overflow-hidden">
          <div className="relative min-h-[300px] overflow-hidden p-6 sm:p-8">
            {cover ? (
              <>
                <img src={cover} alt="Copertă" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-indigo-950/60 to-cyan-900/40" />
              </>
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.28),_transparent_28%),linear-gradient(120deg,#5b21b6_0%,#4f46e5_48%,#0891b2_100%)]" />
            )}

            <div className="relative z-10 flex min-h-[250px] flex-col justify-end gap-6 sm:flex-row sm:items-end">
              <AuroraAvatar src={avatar} initials={initials} size="xl" />

              <div className="flex-1 text-white">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="mb-2 text-sm font-semibold uppercase tracking-[0.24em] text-cyan-100/90">
                      Friends Aurora
                    </p>

                    <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
                      {profile.full_name || profile.username}
                    </h1>

                    <p className="mt-2 text-white/75">@{profile.username}</p>

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

                  <AuroraButton
                    type="button"
                    variant="ghost"
                    onClick={() => setEditing((value) => !value)}
                  >
                    {editing ? "Închide editarea" : "Editează profilul"}
                  </AuroraButton>
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
          <AuroraStat value="—" label="Prieteni" icon="🤝" />
          <AuroraStat value={profile.avatar_url ? 1 : 0} label="Fotografii" icon="🖼️" />
          <AuroraStat value="—" label="Reacții" icon="✨" />
        </section>

        {editing && (
          <AuroraSection title="Editează profilul" subtitle="Actualizează informațiile și imaginile profilului." className="mt-6">
            <form onSubmit={saveProfile} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <AuroraInput label="Nume complet" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} />
                <AuroraInput label="Username" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={30} required hint="3–30 caractere: litere mici, cifre sau _." />
                <AuroraInput label="Oraș" value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} />
                <AuroraInput label="Țară" value={country} onChange={(e) => setCountry(e.target.value)} maxLength={80} />
              </div>

              <AuroraInput multiline label="Biografie" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} rows={4} />

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="rounded-3xl border border-dashed border-violet-300 bg-violet-50/60 p-5 transition-all duration-200 hover:-translate-y-1 hover:scale-[1.01]">
                  <span className="mb-2 block font-semibold text-slate-800">Poză de profil</span>
                  <input type="file" accept="image/*" onChange={selectAvatar} className="block w-full text-sm text-slate-600" />
                  <span className="mt-2 block text-xs text-slate-500">Maximum 5 MB.</span>
                </label>

                <label className="rounded-3xl border border-dashed border-cyan-300 bg-cyan-50/60 p-5 transition-all duration-200 hover:-translate-y-1 hover:scale-[1.01]">
                  <span className="mb-2 block font-semibold text-slate-800">Poză de copertă</span>
                  <input type="file" accept="image/*" onChange={selectCover} className="block w-full text-sm text-slate-600" />
                  <span className="mt-2 block text-xs text-slate-500">Maximum 5 MB.</span>
                </label>
              </div>

              <div className="flex flex-wrap gap-3">
                <AuroraButton type="submit" disabled={saving}>
                  {saving ? "Se salvează..." : "Salvează profilul"}
                </AuroraButton>
                <AuroraButton type="button" variant="secondary" onClick={() => setEditing(false)}>
                  Renunță
                </AuroraButton>
              </div>
            </form>
          </AuroraSection>
        )}

        <section className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
          <AuroraSection title="Despre mine">
            {profile.bio ? (
              <p className="whitespace-pre-wrap leading-7 text-slate-700">{profile.bio}</p>
            ) : (
              <p className="text-slate-500">Nu ai adăugat încă o biografie.</p>
            )}

            <div className="mt-5 space-y-3 text-sm text-slate-600">
              {location && <div className="rounded-2xl bg-slate-50 px-4 py-3">📍 {location}</div>}
              <div className="rounded-2xl bg-slate-50 px-4 py-3">🗓️ Membru din {formatMemberSince(profile.created_at)}</div>
            </div>
          </AuroraSection>

          <div>
            <div className="mb-4">
              <h2 className="text-2xl font-black tracking-tight text-slate-900">Activitatea mea</h2>
              <p className="mt-1 text-sm text-slate-500">Cele mai recente postări.</p>
            </div>

            {posts.length === 0 ? (
              <AuroraCard className="p-6 text-slate-600">Nu ai publicat încă nicio postare.</AuroraCard>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
                  <AuroraCard key={post.id} interactive className="p-5 sm:p-6">
                    <div className="mb-4 flex items-center gap-3">
                      <AuroraAvatar src={profile.avatar_url} initials={initials} size="sm" />
                      <div>
                        <p className="font-bold text-slate-900">{profile.full_name || profile.username}</p>
                        <p className="text-sm text-slate-500">
                          {new Date(post.created_at).toLocaleString("ro-RO")}
                        </p>
                      </div>
                    </div>

                    <p className="whitespace-pre-wrap leading-7 text-slate-800">{post.content}</p>
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
