"use client";

import {
  useEffect,
  useRef,
} from "react";
import type { ActiveCall } from "./types";

const STORAGE_PREFIX =
  "friends:messenger:sound-enabled";

type ToneMode =
  | "incoming"
  | "outgoing";

type AudioContextWindow =
  typeof window & {
    webkitAudioContext?: typeof AudioContext;
  };

let sharedContext: AudioContext | null = null;
let globalUnlockInstalled = false;
let globalUnlocked = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioContextClass =
    window.AudioContext ??
    (window as AudioContextWindow)
      .webkitAudioContext;

  if (!AudioContextClass) {
    return null;
  }

  if (!sharedContext) {
    sharedContext =
      new AudioContextClass();
  }

  return sharedContext;
}

async function resumeContext(): Promise<boolean> {
  const context = getAudioContext();

  if (!context) {
    return false;
  }

  try {
    if (
      context.state === "suspended"
    ) {
      await context.resume();
    }

    globalUnlocked =
      context.state === "running";

    return globalUnlocked;
  } catch {
    return false;
  }
}

function installGlobalUnlock(): void {
  if (
    typeof window === "undefined" ||
    globalUnlockInstalled
  ) {
    return;
  }

  globalUnlockInstalled = true;

  const unlock = () => {
    void resumeContext();

    if (globalUnlocked) {
      window.removeEventListener(
        "pointerdown",
        unlock
      );
      window.removeEventListener(
        "keydown",
        unlock
      );
      window.removeEventListener(
        "touchend",
        unlock
      );
    }
  };

  // Capture = true: prindem prima interacțiune oriunde în aplicație,
  // inclusiv înainte ca alte componente să oprească propagarea.
  window.addEventListener(
    "pointerdown",
    unlock,
    true
  );
  window.addEventListener(
    "keydown",
    unlock,
    true
  );
  window.addEventListener(
    "touchend",
    unlock,
    true
  );
}

function soundsEnabled(
  userId: string
): boolean {
  if (
    typeof window === "undefined" ||
    !userId
  ) {
    return false;
  }

  const stored =
    window.localStorage.getItem(
      `${STORAGE_PREFIX}:${userId}`
    );

  // Dacă utilizatorul a ales explicit OFF, respectăm setarea.
  // Dacă nu a ales încă nimic, păstrăm soneria activă implicit
  // pentru apeluri, ca apelurile să nu fie ratate.
  return stored !== "false";
}

function createToneEngine(
  mode: ToneMode
) {
  const maybeContext = getAudioContext();

  if (!maybeContext) {
    return null;
  }

  // După verificarea de mai sus păstrăm o referință nenulă stabilă.
  // Astfel TypeScript știe că poate fi folosită și în callback-uri async.
  const context: AudioContext =
    maybeContext;

  const master =
    context.createGain();

  master.gain.value =
    mode === "incoming"
      ? 0.085
      : 0.055;

  master.connect(
    context.destination
  );

  let stopped = false;
  let timers: number[] = [];

  function clearTimers() {
    for (const timer of timers) {
      window.clearTimeout(timer);
    }

    timers = [];
  }

  function scheduleTone(
    frequency: number,
    durationMs: number,
    delayMs = 0
  ) {
    const timer =
      window.setTimeout(() => {
        if (
          stopped ||
          context.state !== "running"
        ) {
          return;
        }

        const oscillator =
          context.createOscillator();
        const gain =
          context.createGain();

        oscillator.type = "sine";
        oscillator.frequency
          .setValueAtTime(
            frequency,
            context.currentTime
          );

        const start =
          context.currentTime +
          0.005;

        gain.gain.setValueAtTime(
          0.0001,
          start
        );
        gain.gain
          .exponentialRampToValueAtTime(
            0.8,
            start + 0.018
          );
        gain.gain
          .exponentialRampToValueAtTime(
            0.0001,
            start +
              durationMs / 1000
          );

        oscillator.connect(gain);
        gain.connect(master);

        oscillator.start(start);
        oscillator.stop(
          start +
            durationMs / 1000 +
            0.03
        );
      }, delayMs);

    timers.push(timer);
  }

  function incomingPattern() {
    if (stopped) return;

    scheduleTone(880, 360);
    scheduleTone(660, 360, 440);

    const timer =
      window.setTimeout(
        incomingPattern,
        2800
      );

    timers.push(timer);
  }

  function outgoingPattern() {
    if (stopped) return;

    scheduleTone(440, 430);

    const timer =
      window.setTimeout(
        outgoingPattern,
        2200
      );

    timers.push(timer);
  }

  if (mode === "incoming") {
    incomingPattern();
  } else {
    outgoingPattern();
  }

  return {
    async start() {
      await resumeContext();
    },

    stop() {
      if (stopped) return;

      stopped = true;
      clearTimers();

      try {
        master.disconnect();
      } catch {
        // deja deconectat
      }

      // IMPORTANT:
      // nu închidem sharedContext.
      // Îl păstrăm deblocat pentru următorul apel primit.
    },
  };
}

export default function useCallRingtone(
  activeCall: ActiveCall | null,
  currentUserId: string
) {
  const engineRef =
    useRef<ReturnType<
      typeof createToneEngine
    > | null>(null);

  // Acest hook este montat global prin CallProvider.
  // Deblocăm audio la prima interacțiune cu aplicația,
  // înainte să existe un apel primit.
  useEffect(() => {
    installGlobalUnlock();
  }, []);

  useEffect(() => {
    engineRef.current?.stop();
    engineRef.current = null;

    if (
      !activeCall ||
      activeCall.status !==
        "ringing" ||
      !soundsEnabled(
        currentUserId
      )
    ) {
      return;
    }

    const mode: ToneMode =
      activeCall.direction ===
      "incoming"
        ? "incoming"
        : "outgoing";

    const engine =
      createToneEngine(mode);

    engineRef.current = engine;

    void engine?.start();

    // Fallback: dacă tab-ul nu fusese încă deblocat,
    // primul click/touch va porni imediat contextul existent.
    const resume = () => {
      void resumeContext();
    };

    window.addEventListener(
      "pointerdown",
      resume,
      true
    );
    window.addEventListener(
      "keydown",
      resume,
      true
    );
    window.addEventListener(
      "touchend",
      resume,
      true
    );

    return () => {
      window.removeEventListener(
        "pointerdown",
        resume,
        true
      );
      window.removeEventListener(
        "keydown",
        resume,
        true
      );
      window.removeEventListener(
        "touchend",
        resume,
        true
      );

      engine?.stop();

      if (
        engineRef.current === engine
      ) {
        engineRef.current = null;
      }
    };
  }, [
    activeCall?.id,
    activeCall?.status,
    activeCall?.direction,
    currentUserId,
  ]);
}
