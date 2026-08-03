"use client";

import { useEffect } from "react";
import MessengerShell from "./Shell/MessengerShell";
import ChatHeader from "./chat/ChatHeader";
import MessageList from "./chat/MessageList";
import MessageComposer from "./composer/MessageComposer";
import useConversation from "./hooks/useConversation";
import {
  MessengerProvider,
  useMessengerStore,
} from "./store/MessengerStore";
import { sendMessage } from "./services/messages";
import type { MessengerMessage } from "./types";
import useCurrentUser from "./hooks/useCurrentUser";

type MessengerM3Props = {
  conversationId: string;
};

function MessengerContent({
  conversationId,
}: MessengerM3Props) {
    const currentUserId = useCurrentUser();
  const {
    messages,
    setMessages,
    addMessage,
    replaceMessage,
  } = useMessengerStore();

  const {
    messages: loadedMessages,
    loading,
    error,
  } = useConversation(conversationId);

  useEffect(() => {
    setMessages(loadedMessages);
  }, [loadedMessages, setMessages]);

  return (
    <MessengerShell
      header={<ChatHeader conversationId={conversationId} />}
      messages={
        loading ? (
          <div>Se încarcă...</div>
        ) : error ? (
          <div>{error}</div>
        ) : (
          <MessageList
            messages={messages}
            currentUserId="me"
          />
        )
      }
      composer={
        <MessageComposer
          onSend={async (text) => {
            const tempId = `temporary-${crypto.randomUUID()}`;

            const temporaryMessage: MessengerMessage = {
              id: tempId,
              conversationId,
              senderId: "me",
              text,
              status: "sending",
              createdAt: new Date().toISOString(),
              attachments: [],
              reactions: [],
            };

            addMessage(temporaryMessage);

            try {
              const savedMessage = await sendMessage(
                conversationId,
                text
              );

              replaceMessage(tempId, {
                ...savedMessage,
                senderId: "me",
              });
            } catch (error) {
              setMessages((current) =>
                current.map((message) =>
                  message.id === tempId
                    ? {
                        ...message,
                        status: "failed",
                      }
                    : message
                )
              );

              throw error;
            }
          }}
        />
      }
    />
  );
}

export default function MessengerM3({
  conversationId,
}: MessengerM3Props) {
  return (
    <MessengerProvider initialMessages={[]}>
      <MessengerContent conversationId={conversationId} />
    </MessengerProvider>
  );
}