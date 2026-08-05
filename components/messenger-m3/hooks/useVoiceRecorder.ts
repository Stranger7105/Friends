"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { VoiceRecording } from "../types";

function preferredMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];

  return (
    candidates.find((type) =>
      MediaRecorder.isTypeSupported(type)
    ) ?? ""
  );
}

export default function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recording, setRecording] =
    useState<VoiceRecording | null>(null);
  const [error, setError] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef =
    useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });

    streamRef.current = null;
  }, []);

  const resetRecorderReferences = useCallback(() => {
    recorderRef.current = null;
    chunksRef.current = [];
    startedAtRef.current = 0;
    cancelledRef.current = false;
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    stopStream();
    resetRecorderReferences();

    setIsRecording(false);
    setElapsedSeconds(0);
    setRecording(null);
    setError("");
  }, [
    clearTimer,
    resetRecorderReferences,
    stopStream,
  ]);

  const start = useCallback(async () => {
    if (isRecording) return;

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError(
        "Browserul nu acceptă înregistrarea mesajelor vocale."
      );
      return;
    }

    // Curățăm complet orice sesiune anterioară înainte de una nouă.
    clearTimer();
    stopStream();
    resetRecorderReferences();

    setRecording(null);
    setElapsedSeconds(0);
    setError("");

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

      const mimeType = preferredMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      cancelledRef.current = false;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        clearTimer();
        stopStream();
        setIsRecording(false);

        const wasCancelled = cancelledRef.current;
        const durationSeconds = Math.max(
          1,
          Math.round(
            (Date.now() - startedAtRef.current) / 1000
          )
        );

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        recorderRef.current = null;
        chunksRef.current = [];
        startedAtRef.current = 0;
        cancelledRef.current = false;

        if (wasCancelled) {
          setRecording(null);
          setElapsedSeconds(0);
          return;
        }

        if (!blob.size) {
          setRecording(null);
          setElapsedSeconds(0);
          setError("Înregistrarea audio este goală.");
          return;
        }

        setElapsedSeconds(durationSeconds);
        setRecording({
          blob,
          durationSeconds,
          mimeType: blob.type || recorder.mimeType,
        });
      };

      recorder.start(250);
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setElapsedSeconds(
          Math.max(
            0,
            Math.floor(
              (Date.now() - startedAtRef.current) / 1000
            )
          )
        );
      }, 250);
    } catch (reason) {
      clearTimer();
      stopStream();
      resetRecorderReferences();
      setIsRecording(false);

      setError(
        reason instanceof DOMException &&
        reason.name === "NotAllowedError"
          ? "Permisiunea pentru microfon a fost refuzată."
          : reason instanceof Error
            ? reason.message
            : "Microfonul nu a putut fi pornit."
      );
    }
  }, [
    clearTimer,
    isRecording,
    resetRecorderReferences,
    stopStream,
  ]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;

    if (!recorder || recorder.state === "inactive") {
      return;
    }

    recorder.stop();
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    clearTimer();

    const recorder = recorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      return;
    }

    reset();
  }, [clearTimer, reset]);

  const clearRecording = useCallback(() => {
    reset();
  }, [reset]);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      clearTimer();

      const recorder = recorderRef.current;

      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }

      stopStream();
      recorderRef.current = null;
    };
  }, [clearTimer, stopStream]);

  return {
    isRecording,
    elapsedSeconds,
    recording,
    error,
    start,
    stop,
    cancel,
    clearRecording,
  };
}
