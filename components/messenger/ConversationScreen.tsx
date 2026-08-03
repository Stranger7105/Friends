"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MessengerMessage } from "@/types/messenger";

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
  onSend: (
  text: string,
  replyToId?: string | null
) => Promise<void> | void;

onReact?: (
  messageId: string,
  emoji: string
) => Promise<boolean> | void;
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
onReact,
}: ConversationScreenProps) {
  const router = useRouter();
  const [replyMessage, setReplyMessage] =
  useState<MessengerMessage | null>(null);
 const handleReaction = (
  message: MessengerMessage,
  reaction: string
) => {
  if (!onReact) return;

  void onReact(message.id, reaction);
};

 const typingByConversation: Record<string, boolean> = {};
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
  onReact={handleReaction}
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