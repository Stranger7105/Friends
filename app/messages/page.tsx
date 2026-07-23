"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ConversationMember = {
  conversation_id: number;
  user_id: string;
};

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
};

type Friendship = {
  id: number;
  user_id: string;
  friend_id: string;
};

type Message = {
  id: number;
  conversation_id: number;
  sender_id: string;
  content: string;
  image_path: string | null;
  created_at: string;
  seen_at: string | null;
};

type ConversationCard = {
  id: number;
  friend: Profile | null;
  lastMessage: Message | null;
};

function getInitials(profile: Profile | null) {
  const value = profile?.full_name || profile?.username || "U";

  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function formatConversationTime(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  const now = new Date();

  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("ro-RO", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString("ro-RO", {
    day: "2-digit",
    month: "2-digit",
  });
}

export default function MessagesPage() {
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState("");
  const [conversations, setConversations] = useState<ConversationCard[]>([]);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [showFriends, setShowFriends] = useState(false);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function loadMessagesPage() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    setCurrentUserId(user.id);

    const myMembershipsResult = await supabase
      .from("conversation_members")
      .select("conversation_id, user_id")
      .eq("user_id", user.id);

    if (myMembershipsResult.error) {
      setMessage(
        `Nu am putut încărca conversațiile: ${myMembershipsResult.error.message}`
      );
      setLoading(false);
      return;
    }

    const myMemberships =
      (myMembershipsResult.data || []) as ConversationMember[];

    const conversationIds = myMemberships.map(
      (membership) => membership.conversation_id
    );

    let conversationCards: ConversationCard[] = [];

    if (conversationIds.length > 0) {
      const [allMembersResult, messagesResult] = await Promise.all([
        supabase
          .from("conversation_members")
          .select("conversation_id, user_id")
          .in("conversation_id", conversationIds),

        supabase
          .from("messages")
          .select(
  "id, conversation_id, sender_id, content, image_path, created_at, seen_at"
)
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false }),
      ]);

      if (allMembersResult.error) {
        setMessage(
          `Nu am putut încărca participanții: ${allMembersResult.error.message}`
        );
        setLoading(false);
        return;
      }

     if (messagesResult.error) {
  setMessage(
    `Nu am putut încărca mesajele: ${messagesResult.error.message}`
  );
  setLoading(false);
  return;
}
  


      const allMembers =
        (allMembersResult.data || []) as ConversationMember[];
      const allMessages = (messagesResult.data || []) as Message[];

      const otherUserIds = [
        ...new Set(
          allMembers
            .filter((member) => member.user_id !== user.id)
            .map((member) => member.user_id)
        ),
      ];

      let profiles: Profile[] = [];

      if (otherUserIds.length > 0) {
        const profilesResult = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url, city, country")
          .in("id", otherUserIds);

        if (profilesResult.error) {
          setMessage(
            `Nu am putut încărca profilurile: ${profilesResult.error.message}`
          );
          setLoading(false);
          return;
        }

        profiles = (profilesResult.data || []) as Profile[];
      }

      const profileMap = new Map(
        profiles.map((profile) => [profile.id, profile])
      );

      const lastMessageMap = new Map<number, Message>();

      for (const item of allMessages) {
        if (!lastMessageMap.has(item.conversation_id)) {
          lastMessageMap.set(item.conversation_id, item);
        }
      }

      conversationCards = conversationIds.map((conversationId) => {
        const otherMember = allMembers.find(
          (member) =>
            member.conversation_id === conversationId &&
            member.user_id !== user.id
        );

        return {
          id: conversationId,
          friend: otherMember
            ? profileMap.get(otherMember.user_id) || null
            : null,
          lastMessage: lastMessageMap.get(conversationId) || null,
        };
      });

      conversationCards.sort((a, b) => {
        const aTime = a.lastMessage
          ? new Date(a.lastMessage.created_at).getTime()
          : 0;
        const bTime = b.lastMessage
          ? new Date(b.lastMessage.created_at).getTime()
          : 0;

        return bTime - aTime;
      });
    }

    setConversations(conversationCards);

    const friendshipsResult = await supabase
      .from("friends")
      .select("id, user_id, friend_id")
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

    if (friendshipsResult.error) {
      setMessage(
        `Conversațiile s-au încărcat, dar prietenii nu: ${friendshipsResult.error.message}`
      );
      setLoading(false);
      return;
    }

    const friendships = (friendshipsResult.data || []) as Friendship[];
    const friendIds = friendships.map((friendship) =>
      friendship.user_id === user.id
        ? friendship.friend_id
        : friendship.user_id
    );

    if (friendIds.length === 0) {
      setFriends([]);
      setLoading(false);
      return;
    }

    const friendsResult = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, city, country")
      .in("id", friendIds);

    if (friendsResult.error) {
      setMessage(
        `Conversațiile s-au încărcat, dar lista de prieteni nu: ${friendsResult.error.message}`
      );
    } else {
      setFriends((friendsResult.data || []) as Profile[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadMessagesPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openConversation(friendId: string) {
    setOpeningId(friendId);
    setMessage("");

    const { data, error } = await supabase.rpc(
      "start_direct_conversation",
      {
        other_user_id: friendId,
      }
    );

    if (error) {
      setMessage(
        `Conversația nu a putut fi deschisă: ${error.message}`
      );
      setOpeningId(null);
      return;
    }

    router.push(`/messages/${data}`);
  }

  const visibleConversations = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) return conversations;

    return conversations.filter((conversation) => {
      const fullName =
        conversation.friend?.full_name?.toLowerCase() || "";
      const username =
        conversation.friend?.username?.toLowerCase() || "";
      const lastMessage =
        conversation.lastMessage?.content.toLowerCase() || "";

      return (
        fullName.includes(value) ||
        username.includes(value) ||
        lastMessage.includes(value)
      );
    });
  }, [conversations, search]);

  if (loading) {
    return (
      <main className="aurora-page min-h-screen px-4 py-8">
        <div className="mx-auto max-w-5xl rounded-2xl bg-white p-6 shadow">
          Se încarcă mesajele...
        </div>
      </main>
    );
  }

  return (
    <main className="aurora-page min-h-screen px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold text-gray-900">
            Mesaje
          </h1>

          <button
            type="button"
            onClick={() => setShowFriends((value) => !value)}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-500"
          >
            {showFriends ? "Închide lista" : "Conversație nouă"}
          </button>
        </div>

        {message && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {message}
          </div>
        )}

        {showFriends && (
          <section className="mb-6 rounded-2xl bg-white p-5 shadow">
            <h2 className="mb-4 text-xl font-bold text-gray-900">
              Alege un prieten
            </h2>

            {friends.length === 0 ? (
              <p className="text-gray-600">
                Nu ai încă prieteni cu care să începi o conversație.
              </p>
            ) : (
              <div className="space-y-3">
                {friends.map((friend) => {
                  const location = [friend.city, friend.country]
                    .filter(Boolean)
                    .join(", ");

                  return (
                    <button
                      key={friend.id}
                      type="button"
                      onClick={() => openConversation(friend.id)}
                      disabled={openingId === friend.id}
                      className="flex w-full items-center gap-4 rounded-xl border p-4 text-left hover:bg-gray-50 disabled:opacity-60"
                    >
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-600 font-bold text-white">
                        {friend.avatar_url ? (
                          <img
                            src={friend.avatar_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          getInitials(friend)
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-gray-900">
                          {friend.full_name ||
                            friend.username ||
                            "Utilizator"}
                        </p>

                        {friend.username && (
                          <p className="truncate text-sm text-gray-500">
                            @{friend.username}
                          </p>
                        )}

                        {location && (
                          <p className="mt-1 truncate text-sm text-gray-600">
                            📍 {location}
                          </p>
                        )}
                      </div>

                      <span className="font-semibold text-lime-400">
                        {openingId === friend.id
                          ? "Se deschide..."
                          : "Scrie"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <section className="overflow-hidden rounded-2xl bg-white shadow">
          <div className="border-b p-4">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Caută conversații..."
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-emerald-400"
            />
          </div>

          {visibleConversations.length === 0 ? (
            <div className="p-8 text-center">
              <h2 className="mb-2 text-xl font-semibold text-gray-900">
                Nu ai conversații încă
              </h2>
              <p className="text-gray-500">
                Apasă „Conversație nouă” pentru a începe un chat.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {visibleConversations.map((conversation) => {
                const friend = conversation.friend;
                const lastMessage = conversation.lastMessage;
                const lastMessageIsMine =
                  lastMessage?.sender_id === currentUserId;

                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() =>
                      router.push(`/messages/${conversation.id}`)
                    }
                    className="flex w-full items-center gap-4 p-4 text-left hover:bg-gray-50"
                  >
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-600 text-xl font-bold text-white">
                      {friend?.avatar_url ? (
                        <img
                          src={friend.avatar_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        getInitials(friend)
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="truncate font-bold text-gray-900">
                          {friend?.full_name ||
                            friend?.username ||
                            "Conversație"}
                        </h2>

                        <span className="shrink-0 text-xs text-gray-400">
                          {formatConversationTime(
                            lastMessage?.created_at || null
                          )}
                        </span>
                      </div>

                      <p className="mt-1 truncate text-sm text-gray-500">
                        {lastMessage
                          ? `${
                              lastMessageIsMine ? "Tu: " : ""
                            }${lastMessage.content}`
                          : "Conversație începută. Nu există mesaje încă."}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}