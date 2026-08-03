"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type {
  MessengerConversation,
  MessengerMessage,
} from "@/types/messenger";

type MessengerContextValue = {
  activeConversationId: string | null;
  conversations: MessengerConversation[];
  messagesByConversation: Record<string, MessengerMessage[]>;
  typingByConversation: Record<string, boolean>;

  setActiveConversationId: (conversationId: string | null) => void;
  setConversations: (conversations: MessengerConversation[]) => void;

  replaceMessages: (
    conversationId: string,
    messages: MessengerMessage[]
  ) => void;

  appendMessage: (message: MessengerMessage) => void;

  updateMessage: (
    conversationId: string,
    messageId: string,
    patch: Partial<MessengerMessage>
  ) => void;

  removeMessage: (
    conversationId: string,
    messageId: string
  ) => void;

  setTyping: (
    conversationId: string,
    typing: boolean
  ) => void;
};

const MessengerContext =
  createContext<MessengerContextValue | null>(null);

export function MessengerProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [activeConversationId, setActiveConversationId] =
    useState<string | null>(null);

  const [conversations, setConversations] = useState<
    MessengerConversation[]
  >([]);

  const [messagesByConversation, setMessagesByConversation] =
    useState<Record<string, MessengerMessage[]>>({});

  const [typingByConversation, setTypingByConversation] =
    useState<Record<string, boolean>>({});

  const replaceMessages = useCallback(
    (
      conversationId: string,
      messages: MessengerMessage[]
    ) => {
      setMessagesByConversation((current) => ({
        ...current,
        [conversationId]: messages,
      }));
    },
    []
  );

  const appendMessage = useCallback(
    (message: MessengerMessage) => {
      setMessagesByConversation((current) => {
        const list =
          current[message.conversationId] ?? [];

        if (
          list.some(
            (item) => item.id === message.id
          )
        ) {
          return current;
        }

        return {
          ...current,
          [message.conversationId]: [
            ...list,
            message,
          ],
        };
      });
    },
    []
  );

  const updateMessage = useCallback(
    (
      conversationId: string,
      messageId: string,
      patch: Partial<MessengerMessage>
    ) => {
      setMessagesByConversation((current) => ({
        ...current,
        [conversationId]: (
          current[conversationId] ?? []
        ).map((message) =>
          message.id === messageId
            ? { ...message, ...patch }
            : message
        ),
      }));
    },
    []
  );

  const removeMessage = useCallback(
    (
      conversationId: string,
      messageId: string
    ) => {
      setMessagesByConversation((current) => ({
        ...current,
        [conversationId]: (
          current[conversationId] ?? []
        ).filter(
          (message) => message.id !== messageId
        ),
      }));
    },
    []
  );

  const setTyping = useCallback(
    (
      conversationId: string,
      typing: boolean
    ) => {
      setTypingByConversation((current) => ({
        ...current,
        [conversationId]: typing,
      }));
    },
    []
  );

  const value = useMemo<MessengerContextValue>(
    () => ({
      activeConversationId,
      conversations,
      messagesByConversation,
      typingByConversation,
      setActiveConversationId,
      setConversations,
      replaceMessages,
      appendMessage,
      updateMessage,
      removeMessage,
      setTyping,
    }),
    [
      activeConversationId,
      conversations,
      messagesByConversation,
      typingByConversation,
      replaceMessages,
      appendMessage,
      updateMessage,
      removeMessage,
      setTyping,
    ]
  );

  return (
    <MessengerContext.Provider value={value}>
      {children}
    </MessengerContext.Provider>
  );
}

export function useMessengerContext() {
  const context = useContext(MessengerContext);

  if (!context) {
    throw new Error(
      "useMessengerContext trebuie folosit în interiorul MessengerProvider."
    );
  }

  return context;
}