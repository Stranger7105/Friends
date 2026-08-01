"use client";

import Link from "next/link";
import { Expand, Users, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Friendship = { user_id: string; friend_id: string };
type Profile = { id: string; username: string | null; full_name: string | null; avatar_url: string | null };
type PresencePayload = { user_id: string; online_at: string };

function nameOf(profile: Profile) {
  return profile.full_name || profile.username || "Prieten Friends";
}

function initials(profile: Profile) {
  return nameOf(profile).split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export default function OnlineFriendsCard() {
  const [currentUserId, setCurrentUserId] = useState("");
  const [friends, setFriends] = useState<Profile[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [fullscreen, setFullscreen] = useState(false);

  const loadFriends = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);

    const { data } = await supabase
      .from("friends")
      .select("user_id, friend_id")
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

    const ids = [...new Set(((data || []) as Friendship[]).map((item) => item.user_id === user.id ? item.friend_id : item.user_id))];
    if (!ids.length) {
      setFriends([]);
      return;
    }

    const profiles = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .in("id", ids);

    if (!profiles.error) setFriends((profiles.data || []) as Profile[]);
  }, []);

  useEffect(() => { void loadFriends(); }, [loadFriends]);

  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase.channel("friends-feed-presence", {
      config: { presence: { key: currentUserId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresencePayload>();
        const ids = new Set(Object.values(state).flat().map((item) => item.user_id));
        ids.delete(currentUserId);
        setOnlineIds(ids);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: currentUserId, online_at: new Date().toISOString() } satisfies PresencePayload);
        }
      });

    return () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [currentUserId]);

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

  const onlineFriends = useMemo(
    () => friends.filter((friend) => onlineIds.has(friend.id)).sort((a, b) => nameOf(a).localeCompare(nameOf(b), "ro")),
    [friends, onlineIds],
  );

  const content = (
    <section className={`friends-dashboard-card friends-online-card ${fullscreen ? "is-fullscreen" : ""}`}>
      <header className="friends-dashboard-card-head">
        <div>
          <span>PREZENȚĂ</span>
          <h3><Users size={19} /> Prieteni online</h3>
        </div>
        <button type="button" onClick={() => setFullscreen((value) => !value)} aria-label={fullscreen ? "Închide" : "Deschide pe tot ecranul"}>
          {fullscreen ? <X size={18} /> : <Expand size={18} />}
        </button>
      </header>

      <div className="friends-online-list">
        {onlineFriends.length === 0 ? (
          <p>Niciun prieten nu este activ în Feed acum.</p>
        ) : onlineFriends.map((friend) => (
          <Link href={`/profile/${friend.id}`} key={friend.id} className="friends-online-row">
            <div className="friends-online-avatar">
              {friend.avatar_url ? <img src={friend.avatar_url} alt="" /> : initials(friend)}
              <span />
            </div>
            <strong>{nameOf(friend)}</strong>
          </Link>
        ))}
      </div>
      <Link href="/friends" className="friends-online-all">Vezi toți prietenii <span>→</span></Link>
    </section>
  );

  return fullscreen ? <div className="friends-dashboard-modal">{content}</div> : content;
}
