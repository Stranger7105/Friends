export type GroupRole = "owner" | "admin" | "moderator" | "member";

export type GroupSummary = {
  id: number;
  conversationId: number;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  ownerId: string;
  memberCount: number;
  createdAt: string;
};

export type GroupMember = {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  role: GroupRole;
  joinedAt: string;
};

export type CreateGroupResult = {
  group_id: number;
  conversation_id: number;
};
