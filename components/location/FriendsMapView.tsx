"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Map as MapLibreMap, Marker, Popup } from "maplibre-gl";

export type FriendsMapPoint = {
  id: string;
  name: string;
  city: string;
  latitude: number;
  longitude: number;
};

type FriendsMapViewProps = {
  points: FriendsMapPoint[];
  fullscreen?: boolean;
  onBackgroundClick?: () => void;
};

export default function FriendsMapView({
  points,
  fullscreen = false,
  onBackgroundClick,
}: FriendsMapViewProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const popupRef = useRef<Popup | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function createMap() {
      if (!containerRef.current || mapRef.current) return;

      const maplibregl = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution:
                '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
            },
          },
          layers: [
            {
              id: "osm",
              type: "raster",
              source: "osm",
            },
          ],
        },
        center: [15, 54],
        zoom: fullscreen ? 4.4 : 3.2,
        minZoom: 2,
        maxZoom: 17,
        attributionControl: true,
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

      map.on("click", (event) => {
        const target = event.originalEvent.target as HTMLElement | null;
        if (target?.closest(".friends-map-marker")) return;
        onBackgroundClick?.();
      });

      mapRef.current = map;
    }

    void createMap();

    return () => {
      cancelled = true;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      popupRef.current?.remove();
      popupRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [fullscreen, onBackgroundClick]);

  useEffect(() => {
    async function renderMarkers() {
      const map = mapRef.current;
      if (!map) return;

      const maplibregl = await import("maplibre-gl");

      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      for (const point of points) {
        const markerElement = document.createElement("button");
        markerElement.type = "button";
        markerElement.className = "friends-map-marker";
        markerElement.setAttribute(
          "aria-label",
          `${point.name}, ${point.city}. Deschide profilul.`,
        );

        const dot = document.createElement("span");
        dot.className = "friends-map-marker-dot";
        markerElement.appendChild(dot);

        const label = document.createElement("span");
        label.className = "friends-map-marker-label";
        label.innerHTML = `<strong></strong><small></small>`;
        const strong = label.querySelector("strong");
        const small = label.querySelector("small");
        if (strong) strong.textContent = point.name;
        if (small) small.textContent = point.city;
        markerElement.appendChild(label);

        markerElement.addEventListener("click", (event) => {
          event.stopPropagation();
          router.push(`/profile/${point.id}`);
        });

        const marker = new maplibregl.Marker({
          element: markerElement,
          anchor: "center",
        })
          .setLngLat([point.longitude, point.latitude])
          .addTo(map);

        markersRef.current.push(marker);
      }

      if (points.length === 1) {
        map.easeTo({
          center: [points[0].longitude, points[0].latitude],
          zoom: fullscreen ? 7 : 5,
          duration: 500,
        });
      } else if (points.length > 1) {
        const bounds = new maplibregl.LngLatBounds();
        points.forEach((point) => bounds.extend([point.longitude, point.latitude]));
        map.fitBounds(bounds, {
          padding: fullscreen ? 100 : 44,
          maxZoom: fullscreen ? 8 : 6,
          duration: 500,
        });
      }
    }

    void renderMarkers();
  }, [fullscreen, points, router]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const timer = window.setTimeout(() => {
      map.resize();
    }, 100);

    return () => window.clearTimeout(timer);
  }, [fullscreen]);

  return <div ref={containerRef} className="friends-maplibre-canvas" />;
}
