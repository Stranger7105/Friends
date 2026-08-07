"use client";

import { useEffect, useRef } from "react";
import type { ActiveCall } from "./types";

const SOUND_SETTING_KEYS = [
  "friends_message_sounds_enabled",
  "friends-notification-sound-enabled",
  "friends_notification_sound_enabled",
  "friends-sounds-enabled",
  "friends_sounds_enabled",
];

function soundsEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  for (const key of SOUND_SETTING_KEYS) {
    const value =
      window.localStorage.getItem(key);

    if (value === "false" || value === "0") {
      return false;
    }

    if (value === "true" || value === "1") {
      return true;
    }
  }

  // Până găsim cheia setării existente, apelurile au sonerie implicit.
  return true;
}

type ToneMode = "incoming" | "outgoing";

function createToneEngine(mode: ToneMode) {
  const AudioContextClass =
    window.AudioContext ||
    (
      window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext;

  if (!AudioContextClass) {
    return null;
  }

  const context = new AudioContextClass();
  const master = context.createGain();
  master.gain.value = 0.055;
  master.connect(context.destination);

  let stopped = false;
  let timers: number[] = [];

  function clearTimers() {
    for (const timer of timers) {
      window.clearTimeout(timer);
    }
    timers = [];
  }

  function beep(
    frequency: number,
    durationMs: number,
    delayMs = 0
  ) {
    const timer = window.setTimeout(() => {
      if (stopped) return;

      const oscillator =
        context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;

      gain.gain.setValueAtTime(
        0.0001,
        context.currentTime
      );
      gain.gain.exponentialRampToValueAtTime(
        0.75,
        context.currentTime + 0.02
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        context.currentTime +
          durationMs / 1000
      );

      oscillator.connect(gain);
      gain.connect(master);

      oscillator.start();
      oscillator.stop(
        context.currentTime +
          durationMs / 1000 +
          0.03
      );
    }, delayMs);

    timers.push(timer);
  }

  function scheduleIncoming() {
    if (stopped) return;

    beep(880, 330, 0);
    beep(660, 330, 420);

    const timer = window.setTimeout(
      scheduleIncoming,
      2800
    );
    timers.push(timer);
  }

  function scheduleOutgoing() {
    if (stopped) return;

    beep(440, 420, 0);

    const timer = window.setTimeout(
      scheduleOutgoing,
      2200
    );
    timers.push(timer);
  }

  void context.resume().catch(() => {
    // Browserul poate bloca autoplay până la o interacțiune.
  });

  if (mode === "incoming") {
    scheduleIncoming();
  } else {
    scheduleOutgoing();
  }

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      clearTimers();
      void context.close().catch(() => {});
    },
    resume() {
      void context.resume().catch(() => {});
    },
  };
}

export default function useCallRingtone(
  activeCall: ActiveCall | null
) {
  const engineRef = useRef<ReturnType<
    typeof createToneEngine
  > | null>(null);

  useEffect(() => {
    engineRef.current?.stop();
    engineRef.current = null;

    if (
      !activeCall ||
      activeCall.status !== "ringing" ||
      !soundsEnabled()
    ) {
      return;
    }

    const mode: ToneMode =
      activeCall.direction === "incoming"
        ? "incoming"
        : "outgoing";

    const engine = createToneEngine(mode);
    engineRef.current = engine;

    // Dacă browserul a blocat autoplay, prima atingere/click îl deblochează.
    const resume = () => {
      engine?.resume();
    };

    window.addEventListener(
      "pointerdown",
      resume,
      { once: true }
    );
    window.addEventListener(
      "keydown",
      resume,
      { once: true }
    );

    return () => {
      window.removeEventListener(
        "pointerdown",
        resume
      );
      window.removeEventListener(
        "keydown",
        resume
      );
      engine?.stop();

      if (engineRef.current === engine) {
        engineRef.current = null;
      }
    };
  }, [
    activeCall?.id,
    activeCall?.status,
    activeCall?.direction,
  ]);
}
