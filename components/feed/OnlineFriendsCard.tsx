"use client";

import Link from "next/link";
import {
  Expand,
  MessageCircle,
  Minimize2,
  Search,
  Users,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  location_city: string | null;
};

type PresencePayload = {
  user_id: string;
  online_at: string;
};

function nameOf(profile: Profile) {
  return profile.full_name || profile.username || "Prieten Friends";
}

function initials(profile: Profile) {
  return nameOf(profile)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function cityOf(profile: Profile) {
  return profile.location_city || profile.city || "";
}

export default function OnlineFriendsCard() {
  const cardRef = useRef<HTMLElement | null>(null);

  const [currentUserId, setCurrentUserId] = useState("");
  const [friends, setFriends] = useState<Profile[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadFriends = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setErrorMessage("Lista prietenilor nu poate fi încărcată.");
      setLoading(false);
      return;
    }

    setCurrentUserId(user.id);

    const friendshipsResult = await supabase
      .from("friends")
      .select("user_id, friend_id")
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

    if (friendshipsResult.error) {
      setErrorMessage("Prietenii nu au putut fi încărcați.");
      setLoading(false);
      return;
    }

    const ids = [
      ...new Set(
        ((friendshipsResult.data || []) as Friendship[]).map((item) =>
          item.user_id === user.id ? item.friend_id : item.user_id,
        ),
      ),
    ];

    if (ids.length === 0) {
      setFriends([]);
      setLoading(false);
      return;
    }

    const profilesResult = await supabase
      .from("profiles")
      .select(
        "id, username, full_name, avatar_url, city, location_city",
      )
      .in("id", ids);

    if (profilesResult.error) {
      setErrorMessage("Profilurile prietenilor nu au putut fi încărcate.");
    } else {
      setFriends((profilesResult.data || []) as Profile[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadFriends();

    const channel = supabase
      .channel("friends-card-data")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friends" },
        () => void loadFriends(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        () => void loadFriends(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadFriends]);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase.channel("friends-feed-presence", {
      config: {
        presence: {
          key: currentUserId,
        },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresencePayload>();
        const ids = new Set(
          Object.values(state)
            .flat()
            .map((item) => item.user_id)
            .filter(Boolean),
        );

        ids.delete(currentUserId);
        setOnlineIds(ids);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: currentUserId,
            online_at: new Date().toISOString(),
          } satisfies PresencePayload);
        }
      });

    return () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === cardRef.current);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  async function toggleFullscreen() {
    const card = cardRef.current;
    if (!card) return;

    try {
      if (document.fullscreenElement === card) {
        await document.exitFullscreen();
      } else {
        await card.requestFullscreen({ navigationUI: "hide" });
      }
    } catch (error) {
      console.error("Cardul Prieteni nu a putut schimba modul full-screen:", error);
    }
  }

  const filteredFriends = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ro");

    return friends
      .filter((friend) => {
        if (!normalizedQuery) return true;

        return (
          nameOf(friend).toLocaleLowerCase("ro").includes(normalizedQuery) ||
          cityOf(friend).toLocaleLowerCase("ro").includes(normalizedQuery)
        );
      })
      .sort((a, b) => {
        const onlineDifference =
          Number(onlineIds.has(b.id)) - Number(onlineIds.has(a.id));

        if (onlineDifference !== 0) return onlineDifference;

        return nameOf(a).localeCompare(nameOf(b), "ro");
      });
  }, [friends, onlineIds, query]);

  const onlineCount = useMemo(
    () => friends.filter((friend) => onlineIds.has(friend.id)).length,
    [friends, onlineIds],
  );

  return (
    <section
      ref={cardRef}
      className={`friends-dashboard-card friends-online-card friends-card-p1 ${
        isFullscreen ? "is-native-fullscreen" : ""
      }`}
    >
      <header className="friends-card-p1-header">
        <div>
          <span className="friends-card-p1-kicker">REȚEAUA TA</span>
          <h3>
            <Users size={20} />
            Prieteni
          </h3>
          <p>
            {friends.length} {friends.length === 1 ? "prieten" : "prieteni"}
            <span aria-hidden="true">•</span>
            <strong>{onlineCount} online</strong>
          </p>
        </div>

        <button
          type="button"
          className="friends-card-p1-expand"
          onClick={() => void toggleFullscreen()}
          aria-label={
            isFullscreen
              ? "Ieși din lista de prieteni pe tot ecranul"
              : "Deschide lista de prieteni pe tot ecranul"
          }
          title={isFullscreen ? "Ieși din full-screen" : "Full-screen"}
        >
          {isFullscreen ? <Minimize2 size={20} /> : <Expand size={20} />}
        </button>
      </header>

      <label className="friends-card-p1-search">
        <Search size={17} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Caută după nume sau oraș…"
          aria-label="Caută un prieten"
        />
      </label>

      <div className="friends-card-p1-list">
        {loading ? (
          <div className="friends-card-p1-state">Se încarcă prietenii…</div>
        ) : errorMessage ? (
          <div className="friends-card-p1-state is-error">
            {errorMessage}
          </div>
        ) : filteredFriends.length === 0 ? (
          <div className="friends-card-p1-state">
            {query.trim()
              ? "Nu am găsit niciun prieten pentru această căutare."
              : "Nu ai încă prieteni în listă."}
          </div>
        ) : (
          filteredFriends.map((friend) => {
            const online = onlineIds.has(friend.id);
            const city = cityOf(friend);

            return (
              <article key={friend.id} className="friends-card-p1-row">
                <Link
                  href={`/profile/${friend.id}`}
                  className="friends-card-p1-profile"
                  aria-label={`Deschide profilul lui ${nameOf(friend)}`}
                >
                  <div className="friends-card-p1-avatar">
                    {friend.avatar_url ? (
                      <img src={friend.avatar_url} alt="" />
                    ) : (
                      <span>{initials(friend)}</span>
                    )}

                    <i
                      className={online ? "is-online" : ""}
                      aria-label={online ? "Online" : "Offline"}
                    />
                  </div>

                  <div className="friends-card-p1-details">
                    <strong>{nameOf(friend)}</strong>
                    <span className={online ? "is-online" : ""}>
                      {online ? "Online acum" : "Offline"}
                      {city ? ` • ${city}` : ""}
                    </span>
                  </div>
                </Link>

                <Link
                  href={`/messages/${friend.id}`}
                  className="friends-card-p1-message"
                  aria-label={`Trimite mesaj lui ${nameOf(friend)}`}
                  title="Mesaj"
                >
                  <MessageCircle size={18} />
                </Link>
              </article>
            );
          })
        )}
      </div>

      <footer className="friends-card-p1-footer">
        <Link href="/friends">
          Vezi pagina Prieteni
          <span aria-hidden="true">→</span>
        </Link>
      </footer>
    </section>
  );
}
