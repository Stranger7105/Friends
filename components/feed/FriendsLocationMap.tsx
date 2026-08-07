"use client";

import { Expand, MapPin, Minimize2, RefreshCw, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import FriendsMapCanvas, { type FriendMapPoint } from "@/components/location/FriendsMapCanvas";

type FriendshipRow = { user_id: string; friend_id: string };
type FriendGroup = { id: string; name: string };
type FriendGroupMember = { friend_id: string };
type LocationProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
  location_city: string | null;
  location_latitude: number | null;
  location_longitude: number | null;
  location_visible: boolean | null;
};

function displayName(profile: LocationProfile) {
  return profile.full_name || profile.username || "Prieten Friends";
}

export default function FriendsLocationMap() {
  const cardRef = useRef<HTMLElement | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [groups, setGroups] = useState<FriendGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("all");
  const [points, setPoints] = useState<FriendMapPoint[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [locationVisible, setLocationVisible] = useState(false);
  const [message, setMessage] = useState("");

  const loadGroups = useCallback(async (userId: string) => {
    const result = await supabase
      .from("friend_groups")
      .select("id, name")
      .eq("owner_id", userId)
      .order("name", { ascending: true });

    if (result.error) {
      setMessage(`Grupurile nu au putut fi încărcate: ${result.error.message}`);
      return;
    }

    const nextGroups = (result.data || []) as FriendGroup[];
    setGroups(nextGroups);
    setSelectedGroupId((current) =>
      current === "all" || nextGroups.some((group) => group.id === current)
        ? current
        : "all",
    );
  }, []);

  const loadLocations = useCallback(async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    setCurrentUserId(user.id);

    const [friendshipsResult, ownProfileResult] = await Promise.all([
      supabase
        .from("friends")
        .select("user_id, friend_id")
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`),
      supabase
        .from("profiles")
        .select("location_visible")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    if (!ownProfileResult.error) {
      setLocationVisible(Boolean(ownProfileResult.data?.location_visible));
    }

    if (friendshipsResult.error) {
      setMessage("Harta prietenilor nu a putut fi încărcată.");
      setLoading(false);
      return;
    }

    const allFriendIds = [
      ...new Set(
        ((friendshipsResult.data || []) as FriendshipRow[]).map((item) =>
          item.user_id === user.id ? item.friend_id : item.user_id,
        ),
      ),
    ];

    let visibleFriendIds = allFriendIds;

    if (selectedGroupId !== "all") {
      const membersResult = await supabase
        .from("friend_group_members")
        .select("friend_id")
        .eq("group_id", selectedGroupId);

      if (membersResult.error) {
        setMessage(`Membrii grupului nu au putut fi încărcați: ${membersResult.error.message}`);
        setPoints([]);
        setLoading(false);
        return;
      }

      const memberIds = new Set(
        ((membersResult.data || []) as FriendGroupMember[]).map((member) => member.friend_id),
      );
      visibleFriendIds = allFriendIds.filter((id) => memberIds.has(id));
    }

    const profileIds = [...new Set([user.id, ...visibleFriendIds])];

    const profilesResult = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, city, country, location_city, location_latitude, location_longitude, location_visible")
      .in("id", profileIds)
      .eq("location_visible", true)
      .not("location_latitude", "is", null)
      .not("location_longitude", "is", null);

    if (profilesResult.error) {
      setMessage(`Locațiile nu au putut fi încărcate: ${profilesResult.error.message}`);
      setLoading(false);
      return;
    }

    setPoints(
      ((profilesResult.data || []) as LocationProfile[])
        .filter((profile) =>
          Number.isFinite(profile.location_latitude) &&
          Number.isFinite(profile.location_longitude),
        )
        .map((profile) => ({
          id: profile.id,
          name: profile.id === user.id ? `${displayName(profile)} (Tu)` : displayName(profile),
          city: profile.location_city || profile.city || "Locație activă",
          latitude: Number(profile.location_latitude),
          longitude: Number(profile.location_longitude),
        })),
    );

    setLoading(false);
  }, [selectedGroupId]);

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await loadGroups(user.id);
    })();
  }, [loadGroups]);

  useEffect(() => {
    void loadLocations();

    const channel = supabase
      .channel("friends-location-map")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => void loadLocations())
      .on("postgres_changes", { event: "*", schema: "public", table: "friend_group_members" }, () => void loadLocations())
      .on("postgres_changes", { event: "*", schema: "public", table: "friend_groups" }, async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await loadGroups(user.id);
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [loadGroups, loadLocations]);

  useEffect(() => {
    if (!isFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isFullscreen]);

  function toggleFullscreen() {
    setIsFullscreen((current) => !current);
  }

  useEffect(() => {
    if (
      !currentUserId ||
      !locationVisible ||
      !navigator.geolocation
    ) {
      return;
    }

    let lastSavedAt = 0;

    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const now = Date.now();

        // Nu scriem în Supabase mai des de o dată la 20 secunde.
        if (now - lastSavedAt < 20000) return;
        lastSavedAt = now;

        void (async () => {
          const { error } = await supabase
            .from("profiles")
            .update({
              location_latitude: coords.latitude,
              location_longitude: coords.longitude,
              location_updated_at: new Date().toISOString(),
            })
            .eq("id", currentUserId)
            .eq("location_visible", true);

          if (!error) {
            void loadLocations();
          }
        })();
      },
      (error) => {
        // Dacă utilizatorul retrage permisiunea, nu dezactivăm
        // preferința lui în Friends; doar oprim actualizarea automată.
        if (error.code !== error.PERMISSION_DENIED) {
          console.warn(
            "Actualizarea automată a locației a eșuat:",
            error.message
          );
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 15000,
        timeout: 30000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [currentUserId, loadLocations, locationVisible]);

  async function saveExactLocation() {
    if (!currentUserId || sharing) return;
    if (!navigator.geolocation) {
      setMessage("Browserul nu permite accesul la locație.");
      return;
    }

    setSharing(true);
    setMessage("Se determină locația exactă…");

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const profileResult = await supabase
          .from("profiles")
          .select("city")
          .eq("id", currentUserId)
          .maybeSingle();

        const { error } = await supabase
          .from("profiles")
          .update({
            location_visible: true,
            location_city: profileResult.data?.city || null,
            location_latitude: coords.latitude,
            location_longitude: coords.longitude,
            location_updated_at: new Date().toISOString(),
          })
          .eq("id", currentUserId);

        if (error) {
          setMessage(`Locația nu a putut fi salvată: ${error.message}`);
        } else {
          setLocationVisible(true);
          setMessage(`Locația exactă a fost actualizată (precizie aproximativă: ${Math.round(coords.accuracy)} m).`);
          await loadLocations();
        }

        setSharing(false);
      },
      (error) => {
        setMessage(
          error.code === error.PERMISSION_DENIED
            ? "Permisiunea pentru locație a fost refuzată."
            : error.code === error.TIMEOUT
              ? "Determinarea locației a durat prea mult. Încearcă din nou."
              : "Locația exactă nu a putut fi determinată.",
        );
        setSharing(false);
      },
      { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 },
    );
  }

  async function disableLocation() {
    if (!currentUserId || sharing) return;
    setSharing(true);

    const { error } = await supabase
      .from("profiles")
      .update({ location_visible: false })
      .eq("id", currentUserId);

    if (error) {
      setMessage(`Locația nu a putut fi dezactivată: ${error.message}`);
    } else {
      setLocationVisible(false);
      setMessage("Locația nu mai este afișată pe hartă.");
      await loadLocations();
    }

    setSharing(false);
  }

  const selectedGroupName = useMemo(
    () =>
      selectedGroupId === "all"
        ? "Toți prietenii"
        : groups.find((group) => group.id === selectedGroupId)?.name || "Grup selectat",
    [groups, selectedGroupId],
  );

  return (
    <section
      ref={cardRef}
      className={`aurora-sidebar-card friends-location-card ${isFullscreen ? "is-native-fullscreen" : ""}`}
      style={
        isFullscreen
          ? {
              position: "fixed",
              inset: 0,
              zIndex: 100000,
              width: "100vw",
              height: "100dvh",
              maxWidth: "none",
              margin: 0,
              borderRadius: 0,
              overflow: "auto",
              background: "var(--friends-surface, #08111d)",
              padding: 12,
            }
          : undefined
      }
    >
      <div className="aurora-sidebar-title-row friends-location-header">
        <div>
          <span className="aurora-sidebar-kicker">PRIETENI APROAPE</span>
          <h3>Harta Friends</h3>
        </div>

        <button
          type="button"
          className="friends-location-header-expand"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void toggleFullscreen();
          }}
          aria-label={isFullscreen ? "Ieși din full-screen" : "Deschide full-screen"}
        >
          {isFullscreen ? <Minimize2 size={20} /> : <Expand size={20} />}
        </button>
      </div>

      <label className="friends-map-group-filter">
        <UsersRound size={16} />
        <span>Arată:</span>
        <select
          value={selectedGroupId}
          onChange={(event) => setSelectedGroupId(event.target.value)}
          aria-label="Alege grupul afișat pe hartă"
        >
          <option value="all">Toți prietenii</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>{group.name}</option>
          ))}
        </select>
      </label>

      <div
        className={`friends-location-map ${isFullscreen ? "is-fullscreen" : ""}`}
        style={
          isFullscreen
            ? {
                height: "calc(100dvh - 210px)",
                minHeight: 420,
              }
            : undefined
        }
      >
        <FriendsMapCanvas points={points} fullscreen={isFullscreen} onMapClick={undefined} />

        {loading ? (
          <div className="friends-location-map-state">Se încarcă harta…</div>
        ) : points.length === 0 ? (
          <div className="friends-location-map-state">
            <MapPin size={28} />
            <strong>Nicio locație activă în această selecție.</strong>
            <span>Alege alt grup sau verifică dacă membrii și-au activat locația.</span>
          </div>
        ) : null}

        <div className="friends-location-map-caption">
          <span>
            {selectedGroupName} • {points.length} {points.length === 1 ? "locație" : "locații"}
          </span>
          <span className="friends-location-map-hint">Marker albastru = locație activă</span>
        </div>
      </div>

      <div className="friends-location-sharing">
        <button type="button" onClick={() => void saveExactLocation()} disabled={sharing}>
          <RefreshCw size={15} />
          {sharing
            ? "Se actualizează…"
            : locationVisible
              ? "Actualizează locația exactă"
              : "Activează locația exactă"}
        </button>

        {locationVisible && (
          <button
            type="button"
            className="friends-location-disable-button"
            onClick={() => void disableLocation()}
            disabled={sharing}
          >
            Oprește locația
          </button>
        )}

        <p>Poziția exactă este salvată și reprezentată pe hartă.</p>
        {message && <span>{message}</span>}
      </div>
    </section>
  );
}
