export type UserStatus = "online" | "offline" | "typing";

export interface ConversationUser {
  id: string;
  username: string;
  fullName: string;
  avatarUrl?: string | null;
  status: UserStatus;
}

export interface ConversationMessage {
  id: number;

  conversationId: number;

  senderId: string;

  content: string;

  createdAt: string;

  edited: boolean;

  seen: boolean;

  imageUrl?: string | null;

  attachmentUrl?: string | null;

  attachmentName?: string | null;

  audioUrl?: string | null;

  latitude?: number | null;

  longitude?: number | null;
}

export interface ConversationState {
  conversationId: number;

  currentUserId: string;

  friend: ConversationUser;

  messages: ConversationMessage[];
}

export interface ComposerState {
  value: string;

  sending: boolean;

  uploading: boolean;
}