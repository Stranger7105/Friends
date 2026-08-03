"use client";

import MessageList from "./MessageList";
import useConversation from "../hooks/useConversation";

type ConversationViewProps = {
  conversationId: string;
};

export default function ConversationView({
  conversationId,
}: ConversationViewProps) {
  const {
    messages,
    loading,
    error,
  } = useConversation(conversationId);

  if (loading) {
    return <div>Se încarcă...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <MessageList
      messages={messages}
      currentUserId="me"
    />
  );
}