"use client";

import { useCallback, useState } from "react";

export function useHistory<T>(initialValue: T) {
  const [past, setPast] = useState<T[]>([]);
  const [present, setPresent] = useState<T>(initialValue);
  const [future, setFuture] = useState<T[]>([]);

  const set = useCallback((nextValue: T | ((current: T) => T)) => {
    setPresent((current) => {
      const resolved =
        typeof nextValue === "function"
          ? (nextValue as (current: T) => T)(current)
          : nextValue;

      setPast((items) => [...items, current]);
      setFuture([]);
      return resolved;
    });
  }, []);

  const undo = useCallback(() => {
    setPast((items) => {
      if (items.length === 0) return items;

      const previous = items[items.length - 1];

      setPresent((current) => {
        setFuture((futureItems) => [current, ...futureItems]);
        return previous;
      });

      return items.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((items) => {
      if (items.length === 0) return items;

      const next = items[0];

      setPresent((current) => {
        setPast((pastItems) => [...pastItems, current]);
        return next;
      });

      return items.slice(1);
    });
  }, []);

  const reset = useCallback((value: T) => {
    setPast([]);
    setPresent(value);
    setFuture([]);
  }, []);

  return {
    value: present,
    set,
    undo,
    redo,
    reset,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
