"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

type NotificationRow = {
  id: number;
  recipient_id: string;
  actor_id: string | null;
  type: "reaction" | "comment" | "share" | "friend_request" | "friend_accepted" | "message";
  post_id: number | null;
  friend_request_id: number | null;
  message_id: number | null;
  text: string;
  is_read: boolean;
  created_at: string;
};

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type NotificationWithActor = NotificationRow & {
  actor: Profile | null;
};

function displayName(profile: Profile | null) {
  return profile?.full_name || profile?.username || "Un utilizator";
}

function initials(profile: Profile | null) {
  return displayName(profile)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function relativeDate(value: string) {
  const date = new Date(value);
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

  if (seconds < 30) return "acum";
  if (seconds < 60) return `acum ${seconds} secunde`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `acum ${minutes} ${minutes === 1 ? "minut" : "minute"}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `acum ${hours} ${hours === 1 ? "oră" : "ore"}`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `acum ${days} ${days === 1 ? "zi" : "zile"}`;

  return date.toLocaleString("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function notificationIcon(type: NotificationRow["type"]) {
  if (type === "reaction") return "❤️";
  if (type === "comment") return "💬";
  if (type === "share") return "🔄";
  if (type === "friend_request") return "👥";
  if (type === "friend_accepted") return "✅";
  if (type === "message") return "📩";
  return "🔔";
}

export default function NotificationsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [notifications, setNotifications] = useState<NotificationWithActor[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications]
  );

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    setUserId(user.id);

    const result = await supabase
      .from("notifications")
      .select("id, recipient_id, actor_id, type, post_id, friend_request_id, message_id, text, is_read, created_at")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (result.error) {
      setMessage(`Notificările nu au putut fi încărcate: ${result.error.message}`);
      setLoading(false);
      return;
    }

    const rows = (result.data ?? []) as NotificationRow[];
    const actorIds = [
      ...new Set(
        rows
          .map((item) => item.actor_id)
          .filter((id): id is string => typeof id === "string")
      ),
    ];

    let profileMap = new Map<string, Profile>();

    if (actorIds.length > 0) {
      const profilesResult = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .in("id", actorIds);

      if (!profilesResult.error) {
        const profiles = (profilesResult.data ?? []) as Profile[];
        profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
      }
    }

    setNotifications(
      rows.map((item) => ({
        ...item,
        actor: item.actor_id ? profileMap.get(item.actor_id) ?? null : null,
      }))
    );

    setLoading(false);
  }, [router]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications-page-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        () => void loadNotifications()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadNotifications, userId]);

  async function markOneAsRead(notification: NotificationWithActor) {
    if (notification.is_read) return;

    setProcessing(notification.id);

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notification.id)
      .eq("recipient_id", userId);

    if (error) {
      setMessage(`Notificarea nu a putut fi marcată ca citită: ${error.message}`);
    } else {
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, is_read: true } : item
        )
      );
    }

    setProcessing(null);
  }

  async function markAllAsRead() {
    if (!userId || unreadCount === 0) return;

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_id", userId)
      .eq("is_read", false);

    if (error) {
      setMessage(`Notificările nu au putut fi marcate: ${error.message}`);
      return;
    }

    setNotifications((current) =>
      current.map((item) => ({ ...item, is_read: true }))
    );
  }

  async function deleteNotification(id: number) {
    setProcessing(id);

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id)
      .eq("recipient_id", userId);

    if (error) {
      setMessage(`Notificarea nu a putut fi ștearsă: ${error.message}`);
    } else {
      setNotifications((current) => current.filter((item) => item.id !== id));
    }

    setProcessing(null);
  }

  async function openNotification(notification: NotificationWithActor) {
    await markOneAsRead(notification);

    if (notification.type === "friend_request") {
      router.push("/requests");
      return;
    }

    if (notification.type === "friend_accepted") {
      router.push("/friends");
      return;
    }

    if (
      notification.type === "reaction" ||
      notification.type === "comment" ||
      notification.type === "share"
    ) {
      router.push("/feed");
      return;
    }

    if (notification.type === "message") {
      router.push("/messages");
    }
  }

  return (
    <>
      

      <main className="aurora-page min-h-screen px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Notificări</h1>
              <p className="mt-1 text-gray-600">
                {unreadCount === 0
                  ? "Nu ai notificări necitite."
                  : `${unreadCount} ${unreadCount === 1 ? "notificare necitită" : "notificări necitite"}`}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void markAllAsRead()}
              disabled={unreadCount === 0}
              className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Marchează toate ca citite
            </button>
          </div>

          {message && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
              {message}
            </div>
          )}

          {loading ? (
            <div className="rounded-2xl bg-white p-6 shadow">
              Se încarcă notificările...
            </div>
          ) : notifications.length === 0 ? (
            <div className="rounded-2xl bg-white p-6 text-gray-600 shadow">
              Nu ai încă notificări.
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <article
                  key={notification.id}
                  className={`flex items-start gap-4 rounded-2xl border p-4 shadow-sm transition ${
                    notification.is_read ? "bg-white" : "border-emerald-200 bg-emerald-950/70"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => void openNotification(notification)}
                    className="flex min-w-0 flex-1 items-start gap-4 text-left"
                  >
                    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-600 font-bold text-white">
                      {notification.actor?.avatar_url ? (
                        <img
                          src={notification.actor.avatar_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        initials(notification.actor)
                      )}

                      <span className="absolute -bottom-1 -right-1 rounded-full border-2 border-white bg-white p-0.5 text-lg">
                        {notificationIcon(notification.type)}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-gray-900">
                        <span className="font-bold">
                          {displayName(notification.actor)}
                        </span>{" "}
                        {notification.text}
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        {relativeDate(notification.created_at)}
                      </p>
                    </div>
                  </button>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {!notification.is_read && (
                      <span className="h-3 w-3 rounded-full bg-emerald-600" title="Necitită" />
                    )}

                    <button
                      type="button"
                      onClick={() => void deleteNotification(notification.id)}
                      disabled={processing === notification.id}
                      className="rounded-lg px-2 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Șterge
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
