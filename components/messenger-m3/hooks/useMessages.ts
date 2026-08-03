"use client";

import { useMessengerStore } from "../store/MessengerStore";

export default function useMessages() {
  return useMessengerStore();
}