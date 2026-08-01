"use client";

import { Expand, LocateFixed, MapPin, Minimize2, RefreshCw } from "lucide-react";
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
        .select(
          "id, username, full_name, avatar_url, city, country, location_city, location_latitude, location_longitude, location_visible",
        )
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    if (ownProfileResult.error) {
      setMessage(`Profilul tău nu a putut fi citit: ${ownProfileResult.error.message}`);
    } else {
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

    const profileIds = [...new Set([user.id, ...friendIds])];

    const profilesResult = await supabase
      .from("profiles")
      .select(
        "id, username, full_name, avatar_url, city, country, location_city, location_latitude, location_longitude, location_visible",
      )
      .in("id", profileIds)
      .eq("location_visible", true)
      .not("location_latitude", "is", null)
      .not("location_longitude", "is", null);

    if (profilesResult.error) {
      setMessage(`Locațiile nu au putut fi încărcate: ${profilesResult.error.message}`);
      setLoading(false);
      return;
    }

    const nextPoints = ((profilesResult.data || []) as LocationProfile[])
      .filter(
        (profile) =>
          Number.isFinite(profile.location_latitude) &&
          Number.isFinite(profile.location_longitude),
      )
      .map((profile) => ({
        id: profile.id,
        name:
          profile.id === user.id
            ? `${displayName(profile)} (Tu)`
            : displayName(profile),
        city: profile.location_city || profile.city || "Locație activă",
        latitude: Number(profile.location_latitude),
        longitude: Number(profile.location_longitude),
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
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === cardRef.current);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  async function openFullscreen() {
    const card = cardRef.current;
    if (!card || document.fullscreenElement === card) return;

    try {
      await card.requestFullscreen({ navigationUI: "hide" });
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

        const city = profileResult.data?.city || null;

        const { error } = await supabase
          .from("profiles")
          .update({
            location_visible: true,
            location_city: city,
            location_latitude: coords.latitude,
            location_longitude: coords.longitude,
            location_updated_at: new Date().toISOString(),
          })
          .eq("id", currentUserId);

        if (error) {
          setMessage(`Locația nu a putut fi salvată: ${error.message}`);
        } else {
          setLocationVisible(true);
          setMessage(
            `Locația exactă a fost actualizată (precizie aproximativă: ${Math.round(
              coords.accuracy,
            )} m).`,
          );
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
      {
        enableHighAccuracy: true,
        timeout: 25000,
        maximumAge: 0,
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
      await loadLocations();
    }

    setSharing(false);
  }

  const mapLabel = useMemo(
    () =>
      points.length === 1
        ? "1 utilizator are locația activă"
        : `${points.length} utilizatori au locația activă`,
    [points.length],
  );

  const ownPointVisible = useMemo(
    () => points.some((point) => point.id === currentUserId),
    [currentUserId, points],
  );

  return (
    <section
      ref={cardRef}
      className={`aurora-sidebar-card friends-location-card ${
        isFullscreen ? "is-native-fullscreen" : ""
      }`}
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
            void (isFullscreen ? closeFullscreen() : openFullscreen());
          }}
          aria-label={
            isFullscreen
              ? "Ieși din harta pe tot ecranul"
              : "Deschide harta pe tot ecranul"
          }
          title={isFullscreen ? "Ieși din full-screen" : "Full-screen"}
        >
          {isFullscreen ? <Minimize2 size={20} /> : <Expand size={20} />}
        </button>
      </div>

      <div
        className={`friends-location-map ${
          isFullscreen ? "is-fullscreen" : ""
        }`}
      >
        <FriendsMapCanvas
          points={points}
          fullscreen={isFullscreen}
          onMapClick={undefined}
        />

        {loading ? (
          <div className="friends-location-map-state">Se încarcă harta…</div>
        ) : points.length === 0 ? (
          <div className="friends-location-map-state">
            <MapPin size={28} />
            <strong>Nicio locație activă nu este disponibilă.</strong>
            <span>Activează sau actualizează locația exactă.</span>
          </div>
        ) : null}

        <div className="friends-location-map-caption">
          <span>{mapLabel}</span>
          <span className="friends-location-map-hint">
            {locationVisible && !ownPointVisible
              ? "Locația ta trebuie actualizată"
              : "Marker albastru = locație activă"}
          </span>
        </div>
      </div>

      <div className="friends-location-sharing">
        <button
          type="button"
          onClick={() => void saveExactLocation()}
          disabled={sharing}
        >
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

        <p>
          Poziția exactă este salvată și reprezentată pe hartă. Eticheta afișează
          în continuare doar numele și orașul.
        </p>

        {message && <span>{message}</span>}
      </div>
    </section>
  );
}
