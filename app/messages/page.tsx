"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
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
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  audio_path: string | null;
  location_lat: number | null;
  location_lng: number | null;
  created_at: string;
  seen_at: string | null;
};

type ConversationCard = {
  id: number;
  friend: Profile | null;
  lastMessage: Message | null;
};

type TypingPayload = {
  user_id: string;
  is_typing: boolean;
};

type PresencePayload = {
  user_id: string;
  online_at: string;
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

function getMessagePreview(message: Message | null, mine: boolean) {
  if (!message) return "Conversație începută. Nu există mesaje încă.";

  let preview = message.content?.trim() || "";

  if (message.image_path) {
    preview = preview || "📸 Fotografie";
  } else if (message.audio_path) {
    preview = preview || "🎤 Mesaj vocal";
  } else if (message.attachment_path) {
    preview = `📎 ${message.attachment_name || "Fișier"}`;
  } else if (
    message.location_lat !== null &&
    message.location_lng !== null
  ) {
    preview = "📍 Locație distribuită";
  }

  if (!preview) preview = "Mesaj nou";

  return mine ? `Tu: ${preview}` : preview;
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
  const [onlineByConversation, setOnlineByConversation] = useState<
    Record<number, boolean>
  >({});
  const [typingByConversation, setTypingByConversation] = useState<
    Record<number, boolean>
  >({});

  const conversationIdsRef = useRef<number[]>([]);
  const refreshBusyRef = useRef(false);
  const presenceChannelsRef = useRef<Map<number, RealtimeChannel>>(new Map());
  const typingTimersRef = useRef<
    Map<number, ReturnType<typeof setTimeout>>
  >(new Map());

  const loadMessagesPage = useCallback(
    async (showLoader = true) => {
      if (showLoader) setLoading(true);
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
          `Nu am putut încărca conversațiile: ${myMembershipsResult.error.message}`,
        );
        if (showLoader) setLoading(false);
        return;
      }

      const myMemberships =
        (myMembershipsResult.data || []) as ConversationMember[];

      const conversationIds = myMemberships.map(
        (membership) => membership.conversation_id,
      );

      conversationIdsRef.current = conversationIds;

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
              "id, conversation_id, sender_id, content, image_path, attachment_path, attachment_name, attachment_type, audio_path, location_lat, location_lng, created_at, seen_at",
            )
            .in("conversation_id", conversationIds)
            .order("created_at", { ascending: false }),
        ]);

        if (allMembersResult.error) {
          setMessage(
            `Nu am putut încărca participanții: ${allMembersResult.error.message}`,
          );
          if (showLoader) setLoading(false);
          return;
        }

        if (messagesResult.error) {
          setMessage(
            `Nu am putut încărca mesajele: ${messagesResult.error.message}`,
          );
          if (showLoader) setLoading(false);
          return;
        }

        const allMembers =
          (allMembersResult.data || []) as ConversationMember[];
        const allMessages = (messagesResult.data || []) as Message[];

        const otherUserIds = [
          ...new Set(
            allMembers
              .filter((member) => member.user_id !== user.id)
              .map((member) => member.user_id),
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
              `Nu am putut încărca profilurile: ${profilesResult.error.message}`,
            );
            if (showLoader) setLoading(false);
            return;
          }

          profiles = (profilesResult.data || []) as Profile[];
        }

        const profileMap = new Map(
          profiles.map((profile) => [profile.id, profile]),
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
              member.user_id !== user.id,
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
          `Conversațiile s-au încărcat, dar prietenii nu: ${friendshipsResult.error.message}`,
        );
        if (showLoader) setLoading(false);
        return;
      }

      const friendships = (friendshipsResult.data || []) as Friendship[];
      const friendIds = friendships.map((friendship) =>
        friendship.user_id === user.id
          ? friendship.friend_id
          : friendship.user_id,
      );

      if (friendIds.length === 0) {
        setFriends([]);
        if (showLoader) setLoading(false);
        return;
      }

      const friendsResult = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, city, country")
        .in("id", friendIds);

      if (friendsResult.error) {
        setMessage(
          `Conversațiile s-au încărcat, dar lista de prieteni nu: ${friendsResult.error.message}`,
        );
      } else {
        setFriends((friendsResult.data || []) as Profile[]);
      }

      if (showLoader) setLoading(false);
    },
    [router],
  );

  useEffect(() => {
    void loadMessagesPage();
  }, [loadMessagesPage]);

  useEffect(() => {
    if (!currentUserId) return;

    let stopped = false;

    const refreshList = async () => {
      if (stopped || refreshBusyRef.current) return;

      refreshBusyRef.current = true;

      try {
        await loadMessagesPage(false);
      } finally {
        refreshBusyRef.current = false;
      }
    };

    const channel = supabase
      .channel(`messages-list-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const newMessage = payload.new as Message;

          if (
            conversationIdsRef.current.includes(newMessage.conversation_id)
          ) {
            setConversations((current) => {
              const updated = current.map((conversation) =>
                conversation.id === newMessage.conversation_id
                  ? { ...conversation, lastMessage: newMessage }
                  : conversation,
              );

              updated.sort((a, b) => {
                const aTime = a.lastMessage
                  ? new Date(a.lastMessage.created_at).getTime()
                  : 0;
                const bTime = b.lastMessage
                  ? new Date(b.lastMessage.created_at).getTime()
                  : 0;

                return bTime - aTime;
              });

              return updated;
            });

            setTypingByConversation((current) => ({
              ...current,
              [newMessage.conversation_id]: false,
            }));
          } else {
            void refreshList();
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const updatedMessage = payload.new as Message;

          if (
            conversationIdsRef.current.includes(updatedMessage.conversation_id)
          ) {
            setConversations((current) =>
              current.map((conversation) =>
                conversation.id === updatedMessage.conversation_id &&
                conversation.lastMessage?.id === updatedMessage.id
                  ? { ...conversation, lastMessage: updatedMessage }
                  : conversation,
              ),
            );
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_members",
        },
        () => {
          void refreshList();
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("Realtime pentru lista de mesaje a fost întrerupt.");
        }
      });

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshList();
      }
    }, 1500);

    const handleFocus = () => {
      void refreshList();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshList();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stopped = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      supabase.removeChannel(channel);
    };
  }, [currentUserId, loadMessagesPage]);

  useEffect(() => {
    if (!currentUserId) return;

    const wantedConversationIds = new Set(
      conversations.map((conversation) => conversation.id),
    );

    for (const [conversationId, existingChannel] of presenceChannelsRef.current) {
      if (!wantedConversationIds.has(conversationId)) {
        void existingChannel.untrack();
        supabase.removeChannel(existingChannel);
        presenceChannelsRef.current.delete(conversationId);

        setOnlineByConversation((current) => {
          const next = { ...current };
          delete next[conversationId];
          return next;
        });

        setTypingByConversation((current) => {
          const next = { ...current };
          delete next[conversationId];
          return next;
        });
      }
    }

    for (const conversation of conversations) {
      if (presenceChannelsRef.current.has(conversation.id)) continue;

      const conversationId = conversation.id;
      const friendId = conversation.friend?.id;

      const channel = supabase
        .channel(`conversation-${conversationId}`, {
          config: {
            broadcast: {
              self: false,
            },
            presence: {
              key: currentUserId,
            },
          },
        })
        .on("broadcast", { event: "typing" }, ({ payload }) => {
          const typing = payload as TypingPayload;

          if (!typing || typing.user_id === currentUserId) return;
          if (friendId && typing.user_id !== friendId) return;

          const oldTimer = typingTimersRef.current.get(conversationId);
          if (oldTimer) clearTimeout(oldTimer);

          setTypingByConversation((current) => ({
            ...current,
            [conversationId]: Boolean(typing.is_typing),
          }));

          if (typing.is_typing) {
            const timer = setTimeout(() => {
              setTypingByConversation((current) => ({
                ...current,
                [conversationId]: false,
              }));
              typingTimersRef.current.delete(conversationId);
            }, 2600);

            typingTimersRef.current.set(conversationId, timer);
          }
        })
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState<PresencePayload>();
          const connectedUsers = Object.values(state).flat();

          const friendIsOnline = friendId
            ? connectedUsers.some(
                (presence) => presence.user_id === friendId,
              )
            : connectedUsers.some(
                (presence) => presence.user_id !== currentUserId,
              );

          setOnlineByConversation((current) => ({
            ...current,
            [conversationId]: friendIsOnline,
          }));
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel.track({
              user_id: currentUserId,
              online_at: new Date().toISOString(),
            } satisfies PresencePayload);
          }

          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn(
              `Presence întrerupt pentru conversația ${conversationId}.`,
            );
          }
        });

      presenceChannelsRef.current.set(conversationId, channel);
    }

    return () => {
      // Canalele rămân active între actualizările listei.
      // Curățarea completă se face în efectul de demontare de mai jos.
    };
  }, [conversations, currentUserId]);

  useEffect(() => {
    return () => {
      for (const timer of typingTimersRef.current.values()) {
        clearTimeout(timer);
      }
      typingTimersRef.current.clear();

      for (const channel of presenceChannelsRef.current.values()) {
        void channel.untrack();
        supabase.removeChannel(channel);
      }
      presenceChannelsRef.current.clear();
    };
  }, []);

  async function openConversation(friendId: string) {
    setOpeningId(friendId);
    setMessage("");

    const { data, error } = await supabase.rpc(
      "start_direct_conversation",
      {
        other_user_id: friendId,
      },
    );

    if (error) {
      setMessage(
        `Conversația nu a putut fi deschisă: ${error.message}`,
      );
      setOpeningId(null);
      return;
    }

    router.push(`/messages/${data}`);
  }

  const visibleConversations = useMemo(() => {
    const value = search.trim().toLowerCase();

    const filtered = conversations.filter((conversation) => {
      if (!value) return true;

      const fullName =
        conversation.friend?.full_name?.toLowerCase() || "";
      const username =
        conversation.friend?.username?.toLowerCase() || "";
      const preview = getMessagePreview(
        conversation.lastMessage,
        conversation.lastMessage?.sender_id === currentUserId,
      ).toLowerCase();

      return (
        fullName.includes(value) ||
        username.includes(value) ||
        preview.includes(value)
      );
    });

    return [...filtered].sort((a, b) => {
      const aTyping = typingByConversation[a.id] ? 1 : 0;
      const bTyping = typingByConversation[b.id] ? 1 : 0;

      if (aTyping !== bTyping) return bTyping - aTyping;

      const aTime = a.lastMessage
        ? new Date(a.lastMessage.created_at).getTime()
        : 0;
      const bTime = b.lastMessage
        ? new Date(b.lastMessage.created_at).getTime()
        : 0;

      return bTime - aTime;
    });
  }, [conversations, currentUserId, search, typingByConversation]);

  if (loading) {
    return (
      <main className="aurora-page min-h-screen bg-transparent px-4 py-8">
        <div className="mx-auto max-w-5xl rounded-2xl p-6 shadow" style={{ background: "var(--friends-surface)", color: "var(--friends-text)", border: "1px solid var(--friends-border)" }}>
          Se încarcă mesajele...
        </div>
      </main>
    );
  }

  return (
    <main className="aurora-page min-h-screen bg-transparent px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: "var(--friends-text)" }}>Mesaje</h1>
            <p className="mt-1 text-sm" style={{ color: "var(--friends-muted)" }}>
              Vezi instant cine este online și cine îți scrie.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowFriends((value) => !value)}
            className="rounded-xl px-5 py-2.5 font-semibold text-white shadow-sm transition hover:-translate-y-0.5"
            style={{ background: "var(--friends-primary)" }}
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
          <section className="mb-6 rounded-2xl p-5 shadow" style={{ background: "var(--friends-surface)", color: "var(--friends-text)", border: "1px solid var(--friends-border)" }}>
            <h2 className="mb-4 text-xl font-bold" style={{ color: "var(--friends-text)" }}>
              Alege un prieten
            </h2>

            {friends.length === 0 ? (
              <p style={{ color: "var(--friends-muted)" }}>
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
                      onClick={() => void openConversation(friend.id)}
                      disabled={openingId === friend.id}
                      className="flex w-full items-center gap-4 rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-60"
                      style={{ background: "var(--friends-surface-strong)", color: "var(--friends-text)", borderColor: "var(--friends-border)" }}
                    >
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white"
                        style={{ background: "var(--friends-primary)" }}>
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
                        <p className="truncate font-bold" style={{ color: "var(--friends-text)" }}>
                          {friend.full_name ||
                            friend.username ||
                            "Utilizator"}
                        </p>

                        {friend.username && (
                          <p className="truncate text-sm" style={{ color: "var(--friends-muted)" }}>
                            @{friend.username}
                          </p>
                        )}

                        {location && (
                          <p className="mt-1 truncate text-sm" style={{ color: "var(--friends-muted)" }}>
                            📍 {location}
                          </p>
                        )}
                      </div>

                      <span className="font-semibold" style={{ color: "var(--friends-primary)" }}>
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

        <section className="overflow-hidden rounded-2xl border shadow-xl backdrop-blur" style={{ background: "var(--friends-surface)", color: "var(--friends-text)", borderColor: "var(--friends-border)" }}>
          <div className="border-b p-4" style={{ borderColor: "var(--friends-border)" }}>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Caută conversații..."
              className="w-full rounded-xl border px-4 py-3 outline-none transition"
              style={{ background: "var(--friends-surface-strong)", color: "var(--friends-text)", borderColor: "var(--friends-border)" }}
            />
          </div>

          {visibleConversations.length === 0 ? (
            <div className="p-8 text-center">
              <h2 className="mb-2 text-xl font-semibold" style={{ color: "var(--friends-text)" }}>
                Nu ai conversații încă
              </h2>
              <p style={{ color: "var(--friends-muted)" }}>
                Apasă „Conversație nouă” pentru a începe un chat.
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--friends-border)" }}>
              {visibleConversations.map((conversation) => {
                const friend = conversation.friend;
                const lastMessage = conversation.lastMessage;
                const lastMessageIsMine =
                  lastMessage?.sender_id === currentUserId;
                const isOnline = Boolean(
                  onlineByConversation[conversation.id],
                );
                const isTyping = Boolean(
                  typingByConversation[conversation.id],
                );
                const isUnread = Boolean(
                  lastMessage &&
                    !lastMessageIsMine &&
                    !lastMessage.seen_at,
                );

                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() =>
                      router.push(`/messages/${conversation.id}`)
                    }
                    className="group flex w-full items-center gap-4 p-4 text-left transition hover:-translate-y-0.5"
                    style={{
                      background: isTyping
                        ? "color-mix(in srgb, var(--friends-primary) 12%, var(--friends-surface))"
                        : "transparent",
                      color: "var(--friends-text)",
                      borderColor: "var(--friends-border)",
                    }}
                  >
                    <div className="relative shrink-0">
                      <div
                        className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-full text-xl font-bold text-white transition group-hover:scale-105 ${
                          isOnline
                            ? "ring-4 ring-lime-200 shadow-[0_0_24px_rgba(132,204,22,0.35)]"
                            : ""
                        }`}
                        style={{ background: "var(--friends-primary)" }}
                      >
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

                      <span
                        className={`absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full border-2 border-white ${
                          isOnline ? "bg-green-500" : "bg-gray-300"
                        }`}
                        title={isOnline ? "Online" : "Offline"}
                        aria-label={isOnline ? "Online" : "Offline"}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <h2
                            className={`truncate ${
                              isUnread ? "font-black" : "font-bold"
                            }`}
                            style={{ color: "var(--friends-text)" }}
                          >
                            {friend?.full_name ||
                              friend?.username ||
                              "Conversație"}
                          </h2>

                          {isOnline && (
                            <span className="hidden shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-700 sm:inline">
                              Activ acum
                            </span>
                          )}
                        </div>

                        <span
                          className={`shrink-0 text-xs ${
                            isUnread ? "font-bold" : ""
                          }`}
                          style={{
                            color: isUnread
                              ? "var(--friends-primary)"
                              : "var(--friends-muted)",
                          }}
                        >
                          {formatConversationTime(
                            lastMessage?.created_at || null,
                          )}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center gap-2">
                        <p
                          className={`min-w-0 flex-1 truncate text-sm ${
                            isTyping || isUnread ? "font-bold" : ""
                          }`}
                          style={{
                            color: isTyping
                              ? "var(--friends-primary)"
                              : isUnread
                                ? "var(--friends-text)"
                                : "var(--friends-muted)",
                          }}
                        >
                          {isTyping
                            ? "Scrie..."
                            : getMessagePreview(
                                lastMessage,
                                lastMessageIsMine,
                              )}
                        </p>

                        {isUnread && (
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]"
                            aria-label="Mesaj necitit"
                            title="Mesaj necitit"
                          />
                        )}
                      </div>
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
