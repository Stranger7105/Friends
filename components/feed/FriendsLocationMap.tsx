"use client";

import Link from "next/link";
import { Expand, LocateFixed, MapPin, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

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

type FriendPoint = {
  id: string;
  name: string;
  city: string;
  avatarUrl: string | null;
  x: number;
  y: number;
};

const EUROPE_BOUNDS = {
  minLat: 32,
  maxLat: 72,
  minLng: -25,
  maxLng: 45,
};

function projectPoint(latitude: number, longitude: number) {
  const x =
    ((longitude - EUROPE_BOUNDS.minLng) /
      (EUROPE_BOUNDS.maxLng - EUROPE_BOUNDS.minLng)) *
    100;
  const y =
    (1 -
      (latitude - EUROPE_BOUNDS.minLat) /
        (EUROPE_BOUNDS.maxLat - EUROPE_BOUNDS.minLat)) *
    100;

  return {
    x: Math.min(97, Math.max(3, x)),
    y: Math.min(94, Math.max(6, y)),
  };
}

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
  const [points, setPoints] = useState<FriendPoint[]>([]);
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
      .map((profile) => {
        const projected = projectPoint(
          profile.location_latitude as number,
          profile.location_longitude as number,
        );

        return {
          id: profile.id,
          name: displayName(profile),
          city: profile.location_city || profile.city || "Oraș neprecizat",
          avatarUrl: profile.avatar_url,
          ...projected,
        };
      });

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

  const map = (
    <div
      className={`friends-location-map ${isFullscreen ? "is-fullscreen" : ""}`}
      onClick={() => {
        if (!isFullscreen) setIsFullscreen(true);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (!isFullscreen && (event.key === "Enter" || event.key === " ")) {
          setIsFullscreen(true);
        }
      }}
      aria-label="Deschide harta prietenilor pe tot ecranul"
    >
      <svg
        className="friends-location-map-art"
        viewBox="0 0 800 520"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="mapSea" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#06151d" />
            <stop offset="1" stopColor="#0a2630" />
          </linearGradient>
          <linearGradient id="mapLand" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#153b3c" />
            <stop offset="1" stopColor="#102c32" />
          </linearGradient>
        </defs>
        <rect width="800" height="520" fill="url(#mapSea)" />
        <g fill="url(#mapLand)" stroke="#2b5b59" strokeWidth="2">
          <path d="M128 95 205 57 282 70 319 112 298 154 245 174 219 213 167 205 126 165Z" />
          <path d="M278 91 363 65 448 82 487 123 469 163 411 181 390 222 341 205 315 163Z" />
          <path d="M426 164 514 139 588 160 626 209 605 263 547 278 506 253 475 218Z" />
          <path d="M326 220 387 199 438 229 450 286 417 327 369 314 346 274Z" />
          <path d="M473 274 548 264 598 305 588 359 531 389 477 360 455 318Z" />
          <path d="M582 90 630 78 675 104 664 144 616 153 591 129Z" />
          <path d="M232 239 280 221 311 250 298 294 257 310 228 281Z" />
        </g>
        <g stroke="#2a4b52" strokeWidth="1" opacity=".65">
          <path d="M0 104H800M0 208H800M0 312H800M0 416H800" />
          <path d="M133 0V520M266 0V520M399 0V520M532 0V520M665 0V520" />
        </g>
      </svg>

      <div className="friends-location-map-overlay" aria-hidden="true" />

      {loading ? (
        <div className="friends-location-map-state">Se încarcă harta…</div>
      ) : points.length === 0 ? (
        <div className="friends-location-map-state">
          <MapPin size={28} />
          <strong>Niciun prieten nu și-a activat încă locația.</strong>
          <span>Pe hartă se afișează doar orașul ales de utilizator.</span>
        </div>
      ) : (
        points.map((point) => (
          <Link
            key={point.id}
            href={`/profile/${point.id}`}
            className="friends-location-point"
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
            onClick={(event) => event.stopPropagation()}
            aria-label={`${point.name}, ${point.city}. Deschide profilul.`}
          >
            <span className="friends-location-point-label">
              <strong>{point.name}</strong>
              <small>{point.city}</small>
            </span>
            <span className="friends-location-point-dot" />
            <span className="friends-location-point-pulse" />
          </Link>
        ))
      )}

      <div className="friends-location-map-caption">
        <span>{mapLabel}</span>
        {!isFullscreen && (
          <span className="friends-location-map-expand">
            <Expand size={15} /> Full-screen
          </span>
        )}
      </div>
    </div>
  );

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

        {map}

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
          <div className="friends-location-modal-map">{map}</div>
        </div>
      )}
    </>
  );
}