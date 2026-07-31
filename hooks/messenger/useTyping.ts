"use client";

import { useCallback, useRef, useState } from "react";

export function useTyping(timeoutMs = 1800) {
  const [isTyping, setIsTyping] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markTyping = useCallback(() => {
    setIsTyping(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      timeoutRef.current = null;
    }, timeoutMs);
  }, [timeoutMs]);

  const stopTyping = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setIsTyping(false);
  }, []);

  return { isTyping, markTyping, stopTyping };
}
