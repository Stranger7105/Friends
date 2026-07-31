"use client";

import { useEffect } from "react";
import MessengerProviders from "@/components/messenger/MessengerProviders";
import MessengerShell from "@/components/messenger/MessengerShell";
import { useMessengerContext } from "@/contexts/MessengerContext";
import type {
  MessengerConversation,
  MessengerMessage,
} from "@/types/messenger";

const CURRENT_USER_ID = "demo-current-user";

const demoMessages: MessengerMessage[] = [
  {
    id: "demo-message-1",
    conversationId: "demo-conversation",
    senderId: "demo-friend",
    kind: "text",
    text: "Salut! Aici începe noul Friends Messenger.",
    attachments: [],
    replyToId: null,
    editedAt: null,
    createdAt: new Date(Date.now() - 120000).toISOString(),
    status: "read",
  },
  {
    id: "demo-message-2",
    conversationId: "demo-conversation",
    senderId: CURRENT_USER_ID,
    kind: "text",
    text: "Arată foarte bine și se mișcă rapid.",
    attachments: [],
    replyToId: null,
    editedAt: null,
    createdAt: new Date(Date.now() - 60000).toISOString(),
    status: "read",
  },
];

const demoConversation: MessengerConversation = {
  id: "demo-conversation",
  kind: "direct",
  title: null,
  avatarUrl: null,
  createdBy: CURRENT_USER_ID,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  members: [
    {
      userId: "demo-friend",
      profile: {
        id: "demo-friend",
        username: "prieten",
        fullName: "Prieten Demo",
        avatarUrl: null,
      },
      role: "member",
      joinedAt: new Date().toISOString(),
      lastReadMessageId: "demo-message-2",
    },
  ],
  lastMessage: demoMessages[1],
  unreadCount: 0,
  muted: false,
  pinned: false,
};

function DemoContent() {
  const {
    setConversations,
    replaceMessages,
    setActiveConversationId,
  } = useMessengerContext();

  useEffect(() => {
    setConversations([demoConversation]);
    replaceMessages(demoConversation.id, demoMessages);
    setActiveConversationId(demoConversation.id);
  }, [replaceMessages, setActiveConversationId, setConversations]);

  return <MessengerShell currentUserId={CURRENT_USER_ID} />;
}

export default function MessengerDemoPage() {
  return (
    <main style={{ padding: 18 }}>
      <MessengerProviders>
        <DemoContent />
      </MessengerProviders>
    </main>
  );
}
