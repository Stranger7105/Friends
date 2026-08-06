"use client";

let audioContext: AudioContext | null = null;
let lastPlayedAt = 0;

const MIN_INTERVAL_MS = 650;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioContextConstructor =
    window.AudioContext ??
    (
      window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext;

  if (!AudioContextConstructor) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContextConstructor();
  }

  return audioContext;
}

async function ensureRunning(
  context: AudioContext
): Promise<void> {
  if (context.state === "suspended") {
    await context.resume();
  }
}

function createTone(
  context: AudioContext,
  frequency: number,
  startAt: number,
  duration: number,
  volume: number
): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(
    frequency,
    startAt
  );

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(
    volume,
    startAt + 0.015
  );
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    startAt + duration
  );

  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}

export async function playIncomingMessageSound(
  force = false
): Promise<boolean> {
  const now = Date.now();

  if (
    !force &&
    now - lastPlayedAt < MIN_INTERVAL_MS
  ) {
    return false;
  }

  const context = getAudioContext();

  if (!context) {
    return false;
  }

  try {
    await ensureRunning(context);

    const startAt = context.currentTime + 0.01;

    createTone(
      context,
      740,
      startAt,
      0.16,
      0.055
    );
    createTone(
      context,
      988,
      startAt + 0.11,
      0.19,
      0.045
    );

    lastPlayedAt = now;
    return true;
  } catch {
    return false;
  }
}

export async function unlockMessageSound(): Promise<void> {
  const context = getAudioContext();

  if (!context) {
    return;
  }

  try {
    await ensureRunning(context);
  } catch {
    // Unele browsere permit sunetul numai după o interacțiune.
  }
}
