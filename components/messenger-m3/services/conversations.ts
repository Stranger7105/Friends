import { supabase } from "@/lib/supabase";
import type {
  ConversationMember,
  MessengerConversation,
} from "../types";
import {
  MESSAGE_SELECT,
  mapDatabaseMessage,
  type DatabaseMessage,
} from "./messageMapper";

type DatabaseConversation = {
  id: number;
  title: string | null;
  avatar_url: string | null;
  updated_at: string;
  type: "direct" | "group";
};

type DatabaseMembership = {
  conversation_id: number;
  user_id: string;
};

type DatabaseProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

function profileName(profile?: DatabaseProfile): string {
  return (
    profile?.full_name?.trim() ||
    profile?.username?.trim() ||
    "Utilizator"
  );
}

function mapMembers(
  memberships: DatabaseMembership[],
  profilesById: Map<string, DatabaseProfile>
): ConversationMember[] {
  return memberships.map((membership) => {
    const profile = profilesById.get(membership.user_id);

    return {
      userId: membership.user_id,
      fullName: profileName(profile),
      avatarUrl: profile?.avatar_url ?? undefined,
      online: false,
    };
  });
}

function buildConversation(
  row: DatabaseConversation,
  memberships: DatabaseMembership[],
  profilesById: Map<string, DatabaseProfile>,
  currentUserId: string,
  lastMessage?: DatabaseMessage,
  unreadCount = 0
): MessengerConversation {
  const otherMembership = memberships.find(
    (membership) => membership.user_id !== currentUserId
  );
  const otherProfile = otherMembership
    ? profilesById.get(otherMembership.user_id)
    : undefined;

  const isDirect = row.type === "direct";

  return {
    id: String(row.id),
    title: isDirect
      ? profileName(otherProfile)
      : row.title?.trim() || `Grup ${row.id}`,
    avatarUrl: isDirect
      ? otherProfile?.avatar_url ?? undefined
      : row.avatar_url ?? undefined,
    type: row.type,
    members: mapMembers(memberships, profilesById),
    unreadCount,
    lastMessage: lastMessage
      ? mapDatabaseMessage(lastMessage)
      : undefined,
    updatedAt: row.updated_at,
  };
}

async function loadMembershipsAndProfiles(
  conversationIds: number[]
): Promise<{
  memberships: DatabaseMembership[];
  profilesById: Map<string, DatabaseProfile>;
}> {
  if (conversationIds.length === 0) {
    return {
      memberships: [],
      profilesById: new Map(),
    };
  }

  const { data: membershipsData, error: membershipsError } =
    await supabase
      .from("conversation_members")
      .select("conversation_id, user_id")
      .in("conversation_id", conversationIds);

  if (membershipsError) {
    throw new Error(
      `Membrii conversațiilor nu au putut fi încărcați: ${membershipsError.message}`
    );
  }

  const memberships =
    (membershipsData ?? []) as DatabaseMembership[];
  const profileIds = Array.from(
    new Set(memberships.map((membership) => membership.user_id))
  );

  if (profileIds.length === 0) {
    return {
      memberships,
      profilesById: new Map(),
    };
  }

  const { data: profilesData, error: profilesError } =
    await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .in("id", profileIds);

  if (profilesError) {
    throw new Error(
      `Profilurile nu au putut fi încărcate: ${profilesError.message}`
    );
  }

  const profiles = (profilesData ?? []) as DatabaseProfile[];

  return {
    memberships,
    profilesById: new Map(
      profiles.map((profile) => [profile.id, profile])
    ),
  };
}

export async function getConversationById(
  conversationId: string,
  currentUserId: string
): Promise<MessengerConversation> {
  const numericConversationId = Number(conversationId);

  if (!Number.isInteger(numericConversationId) || numericConversationId <= 0) {
    throw new Error("Identificatorul conversației nu este valid.");
  }

  const { data: membership, error: membershipError } =
    await supabase
      .from("conversation_members")
      .select("conversation_id, user_id")
      .eq("conversation_id", numericConversationId)
      .eq("user_id", currentUserId)
      .maybeSingle();

  if (membershipError) {
    throw new Error(
      `Accesul la conversație nu a putut fi verificat: ${membershipError.message}`
    );
  }

  if (!membership) {
    throw new Error("Nu ai acces la această conversație.");
  }

  const { data: conversationData, error: conversationError } =
    await supabase
      .from("conversations")
      .select("id, title, avatar_url, updated_at, type")
      .eq("id", numericConversationId)
      .single();

  if (conversationError) {
    throw new Error(
      `Conversația nu a putut fi încărcată: ${conversationError.message}`
    );
  }

  const { memberships, profilesById } =
    await loadMembershipsAndProfiles([numericConversationId]);

  return buildConversation(
    conversationData as DatabaseConversation,
    memberships,
    profilesById,
    currentUserId
  );
}

export async function getConversations(
  currentUserId: string
): Promise<MessengerConversation[]> {
  const { data: ownMembershipsData, error: ownMembershipsError } =
    await supabase
      .from("conversation_members")
      .select("conversation_id, user_id")
      .eq("user_id", currentUserId);

  if (ownMembershipsError) {
    throw new Error(
      `Conversațiile nu au putut fi încărcate: ${ownMembershipsError.message}`
    );
  }

  const ownMemberships =
    (ownMembershipsData ?? []) as DatabaseMembership[];
  const conversationIds = ownMemberships.map(
    (membership) => membership.conversation_id
  );

  if (conversationIds.length === 0) {
    return [];
  }

  const [conversationsResult, messagesResult] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, title, avatar_url, updated_at, type")
      .in("id", conversationIds)
      .order("updated_at", { ascending: false }),
    supabase
      .from("messages")
      .select(MESSAGE_SELECT)
      .in("conversation_id", conversationIds)
      .or("deleted_for_everyone.is.null,deleted_for_everyone.eq.false")
      .order("created_at", { ascending: false }),
  ]);

  if (conversationsResult.error) {
    throw new Error(
      `Conversațiile nu au putut fi încărcate: ${conversationsResult.error.message}`
    );
  }

  if (messagesResult.error) {
    throw new Error(
      `Ultimele mesaje nu au putut fi încărcate: ${messagesResult.error.message}`
    );
  }

  const conversations =
    (conversationsResult.data ?? []) as DatabaseConversation[];
  const messages =
    (messagesResult.data ?? []) as DatabaseMessage[];
  const { memberships, profilesById } =
    await loadMembershipsAndProfiles(conversationIds);

  const membershipsByConversation = new Map<
    number,
    DatabaseMembership[]
  >();
  for (const membership of memberships) {
    const list =
      membershipsByConversation.get(membership.conversation_id) ?? [];
    list.push(membership);
    membershipsByConversation.set(membership.conversation_id, list);
  }

  const lastMessageByConversation = new Map<number, DatabaseMessage>();
  const unreadByConversation = new Map<number, number>();

  for (const message of messages) {
    if (!lastMessageByConversation.has(message.conversation_id)) {
      lastMessageByConversation.set(message.conversation_id, message);
    }

    if (message.sender_id !== currentUserId && !message.seen_at) {
      unreadByConversation.set(
        message.conversation_id,
        (unreadByConversation.get(message.conversation_id) ?? 0) + 1
      );
    }
  }

  return conversations.map((conversation) =>
    buildConversation(
      conversation,
      membershipsByConversation.get(conversation.id) ?? [],
      profilesById,
      currentUserId,
      lastMessageByConversation.get(conversation.id),
      unreadByConversation.get(conversation.id) ?? 0
    )
  );
}
