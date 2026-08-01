"use client";

import { Expand, LocateFixed, MapPin, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import FriendsMapCanvas, { type FriendMapPoint } from "@/components/location/FriendsMapCanvas";

type FriendshipRow = {
  user_id: string;
  friend_id: string;
};

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

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function roundToCityLevel(value: number) {
  return Math.round(value * 10) / 10;
}

export default function FriendsLocationMap() {
  const [currentUserId, setCurrentUserId] = useState("");
  const [points, setPoints] = useState<FriendMapPoint[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [locationVisible, setLocationVisible] = useState(false);
  const [message, setMessage] = useState("");

  const loadLocations = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

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

    const friendIds = [
      ...new Set(
        ((friendshipsResult.data || []) as FriendshipRow[]).map((friendship) =>
          friendship.user_id === user.id
            ? friendship.friend_id
            : friendship.user_id,
        ),
      ),
    ];

    if (friendIds.length === 0) {
      setPoints([]);
      setLoading(false);
      return;
    }

    const profilesResult = await supabase
      .from("profiles")
      .select(
        "id, username, full_name, avatar_url, city, country, location_city, location_latitude, location_longitude, location_visible",
      )
      .in("id", friendIds)
      .eq("location_visible", true)
      .not("location_latitude", "is", null)
      .not("location_longitude", "is", null);

    if (profilesResult.error) {
      setMessage("Locațiile prietenilor nu au putut fi încărcate.");
      setLoading(false);
      return;
    }

    const nextPoints = ((profilesResult.data || []) as LocationProfile[])
      .filter(
        (profile) =>
          typeof profile.location_latitude === "number" &&
          typeof profile.location_longitude === "number",
      )
      .map((profile) => ({
        id: profile.id,
        name: displayName(profile),
        city: profile.location_city || profile.city || "Oraș neprecizat",
        latitude: profile.location_latitude as number,
        longitude: profile.location_longitude as number,
      }));

    setPoints(nextPoints);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadLocations();

    const channel = supabase
      .channel("friends-location-map")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        () => void loadLocations(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadLocations]);

  useEffect(() => {
    if (!isFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFullscreen(false);
    };

    window.addEventListener("keydown", onEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onEscape);
    };
  }, [isFullscreen]);

  async function enableLocation() {
    if (!currentUserId || sharing) return;

    if (!navigator.geolocation) {
      setMessage("Browserul nu permite accesul la locație.");
      return;
    }

    setSharing(true);
    setMessage("");

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const profileResult = await supabase
          .from("profiles")
          .select("city")
          .eq("id", currentUserId)
          .maybeSingle();

        const city = profileResult.data?.city || null;
        const { error } = await supabase
          .from("profiles")
          .update({
            location_visible: true,
            location_city: city,
            location_latitude: roundToCityLevel(coords.latitude),
            location_longitude: roundToCityLevel(coords.longitude),
            location_updated_at: new Date().toISOString(),
          })
          .eq("id", currentUserId);

        if (error) {
          setMessage(`Locația nu a putut fi activată: ${error.message}`);
        } else {
          setLocationVisible(true);
          setMessage("Locația este vizibilă prietenilor doar la nivel de oraș.");
          await loadLocations();
        }

        setSharing(false);
      },
      (error) => {
        setMessage(
          error.code === error.PERMISSION_DENIED
            ? "Permisiunea pentru locație a fost refuzată."
            : "Locația nu a putut fi determinată.",
        );
        setSharing(false);
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 },
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
    }

    setSharing(false);
  }

  const mapLabel = useMemo(
    () =>
      points.length === 1
        ? "1 prieten își afișează orașul"
        : `${points.length} prieteni își afișează orașul`,
    [points.length],
  );

  function renderMap(fullscreen: boolean) {
    return (
      <div
        className={`friends-location-map ${fullscreen ? "is-fullscreen" : ""}`}
      >
        <FriendsMapCanvas
          points={points}
          fullscreen={fullscreen}
          onMapClick={fullscreen ? undefined : () => setIsFullscreen(true)}
        />

        {loading ? (
          <div className="friends-location-map-state">Se încarcă harta…</div>
        ) : points.length === 0 ? (
          <div className="friends-location-map-state">
            <MapPin size={28} />
            <strong>Niciun prieten nu și-a activat încă locația.</strong>
            <span>Pe hartă se afișează doar orașul ales de utilizator.</span>
          </div>
        ) : null}

        <div className="friends-location-map-caption">
          <span>{mapLabel}</span>
          {!fullscreen && (
            <button
              type="button"
              className="friends-location-map-expand"
              onClick={() => setIsFullscreen(true)}
            >
              <Expand size={15} /> Full-screen
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <section className="aurora-sidebar-card friends-location-card">
        <div className="aurora-sidebar-title-row">
          <div>
            <span className="aurora-sidebar-kicker">PRIETENI APROAPE</span>
            <h3>Harta Friends</h3>
          </div>
          <LocateFixed size={20} />
        </div>

        {renderMap(false)}

        <div className="friends-location-sharing">
          <button
            type="button"
            onClick={() =>
              void (locationVisible ? disableLocation() : enableLocation())
            }
            disabled={sharing}
          >
            {sharing
              ? "Se actualizează…"
              : locationVisible
                ? "Oprește locația"
                : "Activează locația"}
          </button>
          <p>Se salvează o poziție aproximativă și se afișează doar orașul.</p>
          {message && <span>{message}</span>}
        </div>
      </section>

      {isFullscreen && (
        <div className="friends-location-modal" role="dialog" aria-modal="true">
          <div className="friends-location-modal-header">
            <div>
              <span>HARTA FRIENDS</span>
              <h2>Prietenii care și-au activat locația</h2>
            </div>
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              aria-label="Închide harta"
            >
              <X size={24} />
            </button>
          </div>
          <div className="friends-location-modal-map">{renderMap(true)}</div>
        </div>
      )}
    </>
  );
}
