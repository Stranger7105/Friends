"use client";

import { useEffect } from "react";

function focusComposer() {
  const composer = document.querySelector<HTMLElement>(
    ".friends-feed-composer-slot"
  );

  if (!composer) return;

  composer.scrollIntoView({
    behavior: "auto",
    block: "start",
  });

  window.setTimeout(() => {
    const input = composer.querySelector<
      HTMLTextAreaElement | HTMLInputElement
    >("textarea, input");

    input?.focus();
  }, 0);
}

export default function MobileComposerBridge() {
  useEffect(() => {
    function handleComposeRequest() {
      focusComposer();
    }

    window.addEventListener(
      "friends-mobile-compose",
      handleComposeRequest
    );

    const searchParams = new URLSearchParams(window.location.search);

    if (searchParams.get("compose") === "1") {
      focusComposer();
    }

    return () => {
      window.removeEventListener(
        "friends-mobile-compose",
        handleComposeRequest
      );
    };
  }, []);

  return null;
}