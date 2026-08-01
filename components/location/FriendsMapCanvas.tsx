"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";

export type FriendMapPoint = {
  id: string;
  name: string;
  city: string;
  latitude: number;
  longitude: number;
};

type Props = {
  points: FriendMapPoint[];
  fullscreen?: boolean;
  onMapClick?: () => void;
};

export default function FriendsMapCanvas({ points, fullscreen = false, onMapClick }: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);

  useEffect(() => {
    let cancelled = false;

    void import("maplibre-gl").then((maplibregl) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
            },
          },
          layers: [{ id: "osm", type: "raster", source: "osm" }],
        },
        center: [15, 54],
        zoom: fullscreen ? 4.2 : 3.1,
        minZoom: 2,
        maxZoom: 16,
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.on("click", (event) => {
        const target = event.originalEvent.target as HTMLElement | null;
        if (!target?.closest(".friends-map-marker")) onMapClick?.();
      });
      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [fullscreen, onMapClick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;

    void import("maplibre-gl").then((maplibregl) => {
      if (cancelled) return;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      points.forEach((point) => {
        const element = document.createElement("button");
        element.type = "button";
        element.className = "friends-map-marker";
        element.setAttribute("aria-label", `${point.name}, ${point.city}. Deschide profilul.`);

        const label = document.createElement("span");
        label.className = "friends-map-marker-label";
        const strong = document.createElement("strong");
        strong.textContent = point.name;
        const small = document.createElement("small");
        small.textContent = point.city;
        label.append(strong, small);

        const dot = document.createElement("span");
        dot.className = "friends-map-marker-dot";
        const pulse = document.createElement("span");
        pulse.className = "friends-map-marker-pulse";
        element.append(label, dot, pulse);
        element.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          router.push(`/profile/${point.id}`);
        });

        markersRef.current.push(
          new maplibregl.Marker({ element, anchor: "center" })
            .setLngLat([point.longitude, point.latitude])
            .addTo(map),
        );
      });

      if (points.length === 1) {
        map.easeTo({ center: [points[0].longitude, points[0].latitude], zoom: fullscreen ? 7 : 5 });
      } else if (points.length > 1) {
        const bounds = new maplibregl.LngLatBounds();
        points.forEach((point) => bounds.extend([point.longitude, point.latitude]));
        map.fitBounds(bounds, { padding: fullscreen ? 100 : 42, maxZoom: fullscreen ? 8 : 6 });
      }
    });

    return () => { cancelled = true; };
  }, [fullscreen, points, router]);

  useEffect(() => {
    const timer = window.setTimeout(() => mapRef.current?.resize(), 120);
    return () => window.clearTimeout(timer);
  }, [fullscreen]);

  return <div ref={containerRef} className="friends-map-canvas" aria-label="Hartă interactivă cu locațiile prietenilor" />;
}
