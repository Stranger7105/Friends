export type MessageKind =
  | "text"
  | "image"
  | "video"
  | "voice"
  | "file"
  | "location"
  | "system"
  | "call";

export type MessageDeliveryStatus =
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

export type PresenceState =
  | "online"
  | "offline"
  | "typing"
  | "recording"
  | "calling";

export type CallKind = "audio" | "video";
export type CallStatus =
  | "idle"
  | "ringing"
  | "connecting"
  | "active"
  | "ended"
  | "failed";

export interface MessengerProfile {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
}

export interface MessengerAttachment {
  id: string;
  messageId?: string;
  kind: Exclude<MessageKind, "text" | "system" | "call">;
  url: string;
  name?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
}

export interface MessengerMessage {
  id: string;
  conversationId: string;
  senderId: string;
  kind: MessageKind;
  text: string | null;
  attachments: MessengerAttachment[];
  replyToId: string | null;
  editedAt: string | null;
  createdAt: string;
  status: MessageDeliveryStatus;
  reaction?: string;
}

export interface ConversationMember {
  userId: string;
  profile: MessengerProfile | null;
  role: "owner" | "admin" | "member";
  joinedAt: string;
  lastReadMessageId: string | null;
}

export interface MessengerConversation {
  id: string;
  kind: "direct" | "group";
  title: string | null;
  avatarUrl: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  members: ConversationMember[];
  lastMessage: MessengerMessage | null;
  unreadCount: number;
  muted: boolean;
  pinned: boolean;
}

export interface MessengerPresence {
  userId: string;
  state: PresenceState;
  lastSeenAt: string | null;
}

export interface MessengerCall {
  id: string;
  conversationId: string;
  createdBy: string;
  kind: CallKind;
  status: CallStatus;
  startedAt: string | null;
  endedAt: string | null;
}
