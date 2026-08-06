"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  playIncomingMessageSound,
  unlockMessageSound,
} from "../services/notificationSound";

const STORAGE_PREFIX =
  "friends:messenger:sound-enabled";
const SOUND_CHANGED_EVENT =
  "friends:messenger:sound-preference-changed";

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId || "guest"}`;
}

type SoundPreferenceDetail = {
  userId: string;
  enabled: boolean;
};

export default function useMessageSound(
  userId: string
) {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const key = storageKey(userId);

    function readPreference() {
      setEnabled(
        window.localStorage.getItem(key) === "true"
      );
      setReady(true);
    }

    function handlePreferenceChange(event: Event) {
      const detail = (
        event as CustomEvent<SoundPreferenceDetail>
      ).detail;

      if (detail?.userId === userId) {
        setEnabled(detail.enabled);
      }
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === key) {
        setEnabled(event.newValue === "true");
      }
    }

    readPreference();

    window.addEventListener(
      SOUND_CHANGED_EVENT,
      handlePreferenceChange
    );
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(
        SOUND_CHANGED_EVENT,
        handlePreferenceChange
      );
      window.removeEventListener(
        "storage",
        handleStorage
      );
    };
  }, [userId]);

  const setSoundEnabled = useCallback(
    async (nextEnabled: boolean) => {
      setEnabled(nextEnabled);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          storageKey(userId),
          String(nextEnabled)
        );

        window.dispatchEvent(
          new CustomEvent<SoundPreferenceDetail>(
            SOUND_CHANGED_EVENT,
            {
              detail: {
                userId,
                enabled: nextEnabled,
              },
            }
          )
        );
      }

      if (nextEnabled) {
        await unlockMessageSound();
        await playIncomingMessageSound(true);
      }
    },
    [userId]
  );

  const toggleSound = useCallback(async () => {
    await setSoundEnabled(!enabled);
  }, [enabled, setSoundEnabled]);

  const playSound = useCallback(async () => {
    if (!enabled) return false;
    return playIncomingMessageSound();
  }, [enabled]);

  return {
    soundEnabled: enabled,
    soundPreferenceReady: ready,
    setSoundEnabled,
    toggleSound,
    playSound,
  };
}
