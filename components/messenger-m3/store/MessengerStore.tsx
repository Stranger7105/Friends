"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

import type { MessengerMessage } from "../types";

type MessengerStoreValue = {
  messages: MessengerMessage[];

  setMessages: React.Dispatch<
    React.SetStateAction<MessengerMessage[]>
  >;

  addMessage: (message: MessengerMessage) => void;

  replaceMessage: (
    tempId: string,
    message: MessengerMessage
  ) => void;
};

const MessengerStore =
  createContext<MessengerStoreValue | null>(null);

export function MessengerProvider({
  children,
  initialMessages,
}: {
  children: ReactNode;
  initialMessages: MessengerMessage[];
}) {
  const [messages, setMessages] =
    useState(initialMessages);

  function addMessage(message: MessengerMessage) {
    setMessages((current) => [...current, message]);
  }

  function replaceMessage(
    tempId: string,
    message: MessengerMessage
  ) {
    setMessages((current) =>
      current.map((item) =>
        item.id === tempId ? message : item
      )
    );
  }

  return (
    <MessengerStore.Provider
      value={{
        messages,
        setMessages,
        addMessage,
        replaceMessage,
      }}
    >
      {children}
    </MessengerStore.Provider>
  );
}

export function useMessengerStore() {
  const value = useContext(MessengerStore);

  if (!value) {
    throw new Error(
      "MessengerProvider lipsește."
    );
  }

  return value;
}