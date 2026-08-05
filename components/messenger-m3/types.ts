export type MessageStatus =
  | "sending"
  | "sent"
  | "delivered"
  | "seen"
  | "failed";

export interface MessageReaction {
  id: string;
  emoji: string;
  userId: string;
  createdAt?: string;
}

export interface MessageAttachment {
  id: string;
  type: "image" | "video" | "audio" | "file";
  url: string;
  name?: string;
  size?: number;
}

export interface MessengerMessage {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  status: MessageStatus;
  createdAt: string;
  editedAt?: string;
  deletedForEveryone?: boolean;
  audioPath?: string;
  audioDuration?: number;
  replyToId?: string;
  attachments: MessageAttachment[];
  reactions: MessageReaction[];
}

export interface ConversationMember {
  userId: string;
  fullName: string;
  avatarUrl?: string;
  online: boolean;
}

export interface MessengerConversation {
  id: string;
  title: string;
  avatarUrl?: string;
  type: "direct" | "group";
  members: ConversationMember[];
  unreadCount: number;
  lastMessage?: MessengerMessage;
  updatedAt: string;
}


export interface VoiceRecording {
  blob: Blob;
  durationSeconds: number;
  mimeType: string;
}
