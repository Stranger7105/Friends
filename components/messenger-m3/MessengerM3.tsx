"use client";

import MessengerShell from "./Shell/MessengerShell";
import ChatHeader from "./chat/ChatHeader";
import MessageList from "./chat/MessageList";
import MessageComposer from "./composer/MessageComposer";
import useConversation from "./hooks/useConversation";
import useCall from "@/components/calls/useCall";

type MessengerM3Props = {
  conversationId: string;
};

export default function MessengerM3({
  conversationId,
}: MessengerM3Props) {
  const { startCall, activeCall, busy: callBusy } = useCall();

  const {
    currentUserId,
    conversation,
    messages,
    replyToMessage,
    loading,
    sending,
    editingMessageId,
    deletingMessageId,
    otherUserIsTyping,
    error,
    send,
    sendVoice,
    setTyping,
    selectReply,
    cancelReply,
    reactToMessage,
    editMessage,
    deleteMessageForMe,
    deleteMessageForEveryone,
  } = useConversation(conversationId);

  if (loading) {
    return <main style={{ padding: 16 }}>Se încarcă...</main>;
  }

  if (error && !conversation) {
    return <main style={{ padding: 16 }}>{error}</main>;
  }

  if (!currentUserId || !conversation) {
    return (
      <main style={{ padding: 16 }}>
        Conversația nu este disponibilă.
      </main>
    );
  }

  return (
    <MessengerShell
      header={
        <ChatHeader
          conversation={conversation}
          isTyping={otherUserIsTyping}
          callAvailable={
            conversation.type === "direct" &&
            conversation.members.some(
              (member) => member.userId !== currentUserId
            )
          }
          callBusy={callBusy || Boolean(activeCall)}
          onStartAudioCall={async () => {
            const peer = conversation.members.find(
              (member) => member.userId !== currentUserId
            );

            if (!peer || conversation.type !== "direct") {
              return;
            }

            await startCall(
              {
                conversationId: conversation.id,
                userId: peer.userId,
                fullName: peer.fullName,
                avatarUrl: peer.avatarUrl,
              },
              "audio"
            );
          }}
        />
      }
      messages={
        <>
          {error && (
            <div
              style={{
                marginBottom: 12,
                padding: 10,
                borderRadius: 10,
                background: "rgba(220,38,38,0.18)",
              }}
            >
              {error}
            </div>
          )}

          <MessageList
            messages={messages}
            currentUserId={currentUserId}
            onReply={selectReply}
            onReact={reactToMessage}
            onEdit={editMessage}
            editingMessageId={editingMessageId}
            deletingMessageId={deletingMessageId}
            onDeleteForMe={deleteMessageForMe}
            onDeleteForEveryone={deleteMessageForEveryone}
          />
        </>
      }
      composer={
        <MessageComposer
          onSend={send}
          onSendVoice={sendVoice}
          onTypingChange={setTyping}
          sending={sending}
          replyToMessage={replyToMessage}
          onCancelReply={cancelReply}
        />
      }
    />
  );
}
