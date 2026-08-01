"use client";

import { Expand, LocateFixed, MapPin, Minimize2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";
import FriendsMapCanvas, {
  type FriendMapPoint,
} from "@/components/location/FriendsMapCanvas";

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

function roundToCityLevel(value: number) {
  return Math.round(value * 10) / 10;
}

export default function FriendsLocationMap() {
  const cardRef = useRef<HTMLElement | null>(null);

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
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === cardRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  async function openFullscreen() {
    const card = cardRef.current;

    if (!card || document.fullscreenElement === card) return;

    try {
      await card.requestFullscreen();
    } catch (error) {
      console.error("Harta nu a putut intra în full-screen:", error);
      setMessage("Browserul nu a permis deschiderea hărții pe tot ecranul.");
    }
  }

  async function closeFullscreen() {
    if (!document.fullscreenElement) return;

    try {
      await document.exitFullscreen();
    } catch (error) {
      console.error("Harta nu a putut ieși din full-screen:", error);
    }
  }

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
      {
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 600000,
      },
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

  return (
    <section
      ref={cardRef}
      className="aurora-sidebar-card friends-location-card"
      style={
        isFullscreen
          ? {
              width: "100vw",
              height: "100vh",
              maxWidth: "none",
              maxHeight: "none",
              margin: 0,
              padding: 18,
              borderRadius: 0,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              background: "#07171f",
            }
          : undefined
      }
    >
      <div
        className="aurora-sidebar-title-row"
        style={{ flex: "0 0 auto" }}
      >
        <div>
          <span className="aurora-sidebar-kicker">PRIETENI APROAPE</span>
          <h3>Harta Friends</h3>
        </div>

        {isFullscreen ? (
          <button
            type="button"
            onClick={() => void closeFullscreen()}
            aria-label="Închide harta pe tot ecranul"
            title="Ieși din full-screen"
            style={{
              display: "grid",
              placeItems: "center",
              width: 40,
              height: 40,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.18)",
              background: "rgba(255,255,255,.08)",
              color: "white",
              cursor: "pointer",
            }}
          >
            <Minimize2 size={20} />
          </button>
        ) : (
          <LocateFixed size={20} />
        )}
      </div>

      <div
        className={`friends-location-map ${isFullscreen ? "is-fullscreen" : ""}`}
        style={
          isFullscreen
            ? {
                flex: "1 1 auto",
                width: "100%",
                height: "auto",
                minHeight: 0,
                borderRadius: 16,
                overflow: "hidden",
              }
            : undefined
        }
      >
        <FriendsMapCanvas
          points={points}
          fullscreen={isFullscreen}
          onMapClick={isFullscreen ? undefined : () => void openFullscreen()}
        />

        {loading ? (
          <div className="friends-location-map-state">
            Se încarcă harta…
          </div>
        ) : points.length === 0 ? (
          <div className="friends-location-map-state">
            <MapPin size={28} />
            <strong>Niciun prieten nu și-a activat încă locația.</strong>
            <span>Pe hartă se afișează doar orașul ales de utilizator.</span>
          </div>
        ) : null}

        <div className="friends-location-map-caption">
          <span>{mapLabel}</span>

          {!isFullscreen && (
            <button
              type="button"
              className="friends-location-map-expand"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void openFullscreen();
              }}
            >
              <Expand size={15} />
              Full-screen
            </button>
          )}
        </div>
      </div>

      <div
        className="friends-location-sharing"
        style={{ flex: "0 0 auto" }}
      >
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
  );
}
