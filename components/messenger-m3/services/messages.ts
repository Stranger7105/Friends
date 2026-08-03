import { supabase } from "@/lib/supabase";
import type {
  MessengerConversation,
  MessengerMessage,
} from "../types";

type DatabaseConversation = {
  id: number;
  title: string | null;
  avatar_url: string | null;
  updated_at: string;
  type: "direct" | "group";
};

type DatabaseConversationMember = {
  conversation_id: number;
  user_id: string;
};

type DatabaseProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type DatabaseMessage = {
  id: number;
  conversation_id: number;
  sender_id: string;
  content: string | null;
  created_at: string;
  edited_at: string | null;
  seen_at: string | null;
  reply_to_message_id: number | null;
};

function mapMessage(row: DatabaseMessage): MessengerMessage {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    senderId: row.sender_id,
    text: row.content ?? "",
    status: row.seen_at ? "seen" : "sent",
    createdAt: row.created_at,
    editedAt: row.edited_at ?? undefined,
    replyToId:
      row.reply_to_message_id !== null
        ? String(row.reply_to_message_id)
        : undefined,
    attachments: [],
    reactions: [],
  };
}

function getProfileName(profile: DatabaseProfile | undefined): string {
  if (!profile) return "Utilizator";

  const fullName = profile.full_name?.trim();
  if (fullName) return fullName;

  const username = profile.username?.trim();
  if (username) return username;

  return "Utilizator";
}

export async function getConversations(): Promise<
  MessengerConversation[]
> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Utilizatorul nu este autentificat.");
  }

  const { data: membershipData, error: membershipError } =
    await supabase
      .from("conversation_members")
      .select("conversation_id, user_id")
      .eq("user_id", user.id);

  if (membershipError) {
    throw new Error(
      `Participările la conversații nu au putut fi încărcate: ${membershipError.message}`
    );
  }

  const ownMemberships =
    (membershipData ?? []) as DatabaseConversationMember[];

  const conversationIds = ownMemberships.map(
    (membership) => membership.conversation_id
  );

  if (conversationIds.length === 0) {
    return [];
  }

  const [
    conversationsResult,
    membersResult,
    messagesResult,
  ] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, title, avatar_url, updated_at, type")
      .in("id", conversationIds)
      .order("updated_at", { ascending: false }),

    supabase
      .from("conversation_members")
      .select("conversation_id, user_id")
      .in("conversation_id", conversationIds),

    supabase
      .from("messages")
      .select(
        "id, conversation_id, sender_id, content, created_at, edited_at, seen_at, reply_to_message_id"
      )
      .in("conversation_id", conversationIds)
      .eq("deleted_for_everyone", false)
      .order("created_at", { ascending: false }),
  ]);

  if (conversationsResult.error) {
    throw new Error(
      `Conversațiile nu au putut fi încărcate: ${conversationsResult.error.message}`
    );
  }

  if (membersResult.error) {
    throw new Error(
      `Membrii conversațiilor nu au putut fi încărcați: ${membersResult.error.message}`
    );
  }

  if (messagesResult.error) {
    throw new Error(
      `Ultimele mesaje nu au putut fi încărcate: ${messagesResult.error.message}`
    );
  }

  const conversations =
    (conversationsResult.data ?? []) as DatabaseConversation[];

  const memberships =
    (membersResult.data ?? []) as DatabaseConversationMember[];

  const messages =
    (messagesResult.data ?? []) as DatabaseMessage[];

  const profileIds = Array.from(
    new Set(memberships.map((membership) => membership.user_id))
  );

  const { data: profilesData, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url")
    .in("id", profileIds);

  if (profilesError) {
    throw new Error(
      `Profilurile participanților nu au putut fi încărcate: ${profilesError.message}`
    );
  }

  const profiles = (profilesData ?? []) as DatabaseProfile[];

  const profilesById = new Map(
    profiles.map((profile) => [profile.id, profile])
  );

  const membersByConversation = new Map<
    number,
    DatabaseConversationMember[]
  >();

  for (const membership of memberships) {
    const current =
      membersByConversation.get(membership.conversation_id) ?? [];

    current.push(membership);
    membersByConversation.set(membership.conversation_id, current);
  }

  const lastMessageByConversation = new Map<number, DatabaseMessage>();
  const unreadCountByConversation = new Map<number, number>();

  for (const message of messages) {
    if (!lastMessageByConversation.has(message.conversation_id)) {
      lastMessageByConversation.set(message.conversation_id, message);
    }

    if (message.sender_id !== user.id && message.seen_at === null) {
      unreadCountByConversation.set(
        message.conversation_id,
        (unreadCountByConversation.get(message.conversation_id) ?? 0) + 1
      );
    }
  }

  return conversations.map((conversation) => {
    const conversationMemberships =
      membersByConversation.get(conversation.id) ?? [];

    const otherMembership = conversationMemberships.find(
      (membership) => membership.user_id !== user.id
    );

    const otherProfile = otherMembership
      ? profilesById.get(otherMembership.user_id)
      : undefined;

    const members = conversationMemberships.map((membership) => {
      const profile = profilesById.get(membership.user_id);

      return {
        userId: membership.user_id,
        fullName: getProfileName(profile),
        avatarUrl: profile?.avatar_url ?? undefined,
        online: false,
      };
    });

    const directTitle = getProfileName(otherProfile);
    const directAvatar = otherProfile?.avatar_url ?? undefined;
    const lastMessage = lastMessageByConversation.get(conversation.id);

    return {
      id: String(conversation.id),
      title:
        conversation.type === "direct"
          ? directTitle
          : conversation.title?.trim() ||
            `Grup ${conversation.id}`,
      avatarUrl:
        conversation.type === "direct"
          ? directAvatar
          : conversation.avatar_url ?? undefined,
      updatedAt: conversation.updated_at,
      members,
      unreadCount:
        unreadCountByConversation.get(conversation.id) ?? 0,
      lastMessage: lastMessage
        ? mapMessage(lastMessage)
        : undefined,
    };
  });
}

export async function getMessages(
  conversationId: string
): Promise<MessengerMessage[]> {
  const numericConversationId = Number(conversationId);

  if (!Number.isFinite(numericConversationId)) {
    throw new Error(
      "Identificatorul conversației nu este valid."
    );
  }

  const { data, error } = await supabase
    .from("messages")
    .select(
      "id, conversation_id, sender_id, content, created_at, edited_at, seen_at, reply_to_message_id"
    )
    .eq("conversation_id", numericConversationId)
    .eq("deleted_for_everyone", false)
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    throw new Error(
      `Mesajele nu au putut fi încărcate: ${error.message}`
    );
  }

  return ((data ?? []) as DatabaseMessage[]).map(mapMessage);
}

export async function sendMessage(
  conversationId: string,
  text: string
): Promise<MessengerMessage> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Utilizatorul nu este autentificat.");
  }

  const numericConversationId = Number(conversationId);
  const content = text.trim();

  if (!Number.isFinite(numericConversationId)) {
    throw new Error(
      "Identificatorul conversației nu este valid."
    );
  }

  if (!content) {
    throw new Error("Mesajul este gol.");
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: numericConversationId,
      sender_id: user.id,
      content,
    })
    .select(
      "id, conversation_id, sender_id, content, created_at, edited_at, seen_at, reply_to_message_id"
    )
    .single();

  if (error) {
    throw new Error(
      `Mesajul nu a putut fi trimis: ${error.message}`
    );
  }

  return mapMessage(data as DatabaseMessage);
}

export async function editMessage(
  messageId: string,
  text: string
): Promise<void> {
  void messageId;
  void text;
  throw new Error("Not implemented");
}

export async function deleteMessage(
  messageId: string
): Promise<void> {
  void messageId;
  throw new Error("Not implemented");
}

export async function reactToMessage(
  messageId: string,
  emoji: string
): Promise<void> {
  void messageId;
  void emoji;
  throw new Error("Not implemented");
}