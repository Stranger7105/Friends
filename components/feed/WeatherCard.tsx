"use client";

import { CloudSun, Expand, MapPin, X } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type WeatherState = {
  city: string;
  temperature: number | null;
  apparent: number | null;
  wind: number | null;
};

export default function WeatherCard() {
  const [fullscreen, setFullscreen] = useState(false);
  const [weather, setWeather] = useState<WeatherState>({ city: "Orașul tău", temperature: null, apparent: null, wind: null });
  const [message, setMessage] = useState("Se pregătește meteo…");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("city, location_latitude, location_longitude")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;
      const city = profile?.city || "Orașul tău";
      const latitude = Number(profile?.location_latitude);
      const longitude = Number(profile?.location_longitude);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        setWeather((current) => ({ ...current, city }));
        setMessage("Activează locația pe hartă pentru meteo local.");
        return;
      }

      try {
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,wind_speed_10m&timezone=auto`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error("weather");
        const payload = await response.json();
        if (cancelled) return;
        setWeather({
          city,
          temperature: Number(payload.current?.temperature_2m),
          apparent: Number(payload.current?.apparent_temperature),
          wind: Number(payload.current?.wind_speed_10m),
        });
        setMessage("");
      } catch {
        setWeather((current) => ({ ...current, city }));
        setMessage("Meteo nu este disponibil momentan.");
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

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

  const content = (
    <section className={`friends-dashboard-card friends-weather-card ${fullscreen ? "is-fullscreen" : ""}`}>
      <header className="friends-dashboard-card-head">
        <div>
          <span>ACUM</span>
          <h3><CloudSun size={19} /> Meteo</h3>
        </div>
        <button type="button" onClick={() => setFullscreen((value) => !value)} aria-label={fullscreen ? "Închide" : "Deschide pe tot ecranul"}>
          {fullscreen ? <X size={18} /> : <Expand size={18} />}
        </button>
      </header>

      <div className="friends-weather-location"><MapPin size={15} /> {weather.city}</div>
      {weather.temperature !== null ? (
        <>
          <div className="friends-weather-temperature">{Math.round(weather.temperature)}°</div>
          <div className="friends-weather-details">
            <span>Se simte {Math.round(weather.apparent ?? weather.temperature)}°</span>
            <span>Vânt {Math.round(weather.wind ?? 0)} km/h</span>
          </div>
        </>
      ) : (
        <div className="friends-weather-empty">{message}</div>
      )}
    </section>
  );

  return fullscreen ? <div className="friends-dashboard-modal">{content}</div> : content;
}
