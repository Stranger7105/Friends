"use client";

import { useEffect } from "react";

export default function PWARegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    async function registerServiceWorker() {
      try {
        await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
      } catch (error) {
        console.error(
          "Service Worker-ul Friends nu a putut fi înregistrat:",
          error
        );
      }
    }

    void registerServiceWorker();
  }, []);

  return null;
}