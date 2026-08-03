"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MessengerMessage } from "@/types/messenger";
import { useMessengerContext } from "@/contexts/MessengerContext";
import ChatHeader from "./ChatHeader";
import Composer from "./Composer";
import Layout from "./Layout";
import MessageList from "./MessageList";
import TypingIndicator from "./TypingIndicator";

type ConversationScreenProps = {
  conversationId: string | null;
  currentUserId: string;
  title?: string;
  subtitle?: string;
  avatarUrl?: string | null;
  initials?: string;
  messages: MessengerMessage[];
  loading?: boolean;
  sending?: boolean;
  error?: string;
  onSend: (text: string) => Promise<void> | void;
};

export default function ConversationScreen({
  conversationId,
  currentUserId,
  title = "Friends Messenger",
  subtitle = "Offline",
  avatarUrl = null,
  initials = "F",
  messages,
  loading = false,
  sending = false,
  error = "",
  onSend,
}: ConversationScreenProps) {
  const router = useRouter();
  const [replyMessage, setReplyMessage] =
  useState<MessengerMessage | null>(null);

  const {
    typingByConversation,
  } = useMessengerContext();

  const friendIsTyping = conversationId
    ? typingByConversation[conversationId] ?? false
    : false;

  return (
    <div className="friends-m2-screen">
      <Layout
        header={
          <ChatHeader
            title={title}
            subtitle={subtitle}
            avatarUrl={avatarUrl}
            initials={initials}
            onBack={() => router.push("/messages")}
          />
        }
        messages={
          <>
           <MessageList
  messages={messages}
  currentUserId={currentUserId}
  loading={loading}
  error={error}
  onReply={setReplyMessage}
/>

            <TypingIndicator
              visible={friendIsTyping}
              name={title}
            />
          </>
        }
        composer={
         <Composer
  conversationId={conversationId}
  currentUserId={currentUserId}
  onSend={onSend}
  sending={sending}
  replyMessage={replyMessage}
  onCancelReply={() => setReplyMessage(null)}
/>
        }
      />
    </div>
  );
}