"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import type { EmojiClickData } from "emoji-picker-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import ConversationCallMenu from "@/components/calls/ConversationCallMenu";
import { requestGlobalCall } from "@/components/calls/globalCallEvents";
import "./aurora-chat.css";
import "@/styles/friends-mobile-chat.css";
import "@/styles/friends-mobile-conversation-header.css";
const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
});

type Message = {
  id: number;
  conversation_id: number;
  sender_id: string;
  content: string;
  image_path: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  attachment_size: number | null;
  audio_path: string | null;
  audio_duration: number | null;
  location_lat: number | null;
  location_lng: number | null;
  location_label: string | null;
  edited_at: string | null;
  pinned_at: string | null;
  pinned_by: string | null;
  reply_to_message_id: number | null;
  created_at: string;
  seen_at: string | null;
};

type Reaction = {
  id: number;
  message_id: number;
  user_id: string;
  emoji: string;
  created_at: string;
};

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😡"] as const;

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type TypingPayload = {
  user_id: string;
  is_typing: boolean;
};

type PresencePayload = {
  user_id: string;
  online_at: string;
};

type GalleryTab = "media" | "documents" | "audio";

type PendingUpload = {
  id: string;
  file: File;
  kind: "image" | "file";
  previewUrl: string | null;
};


type ChatTheme = "aurora" | "forest" | "ocean" | "sunset" | "midnight" | "ice";
type ChatWallpaper = "aurora" | "waves" | "forest" | "sunset" | "minimal" | "none";

type ChatAppearancePreference = {
  conversation_id: number;
  user_id: string;
  theme: ChatTheme;
  wallpaper: ChatWallpaper;
  blur_strength: number;
};

const CHAT_THEMES: Array<{ id: ChatTheme; label: string; emoji: string }> = [
  { id: "aurora", label: "Aurora", emoji: "🌌" },
  { id: "forest", label: "Forest", emoji: "🌲" },
  { id: "ocean", label: "Ocean", emoji: "🌊" },
  { id: "sunset", label: "Sunset", emoji: "🌅" },
  { id: "midnight", label: "Midnight", emoji: "🌙" },
  { id: "ice", label: "Ice", emoji: "❄️" },
];

const CHAT_WALLPAPERS: Array<{ id: ChatWallpaper; label: string }> = [
  { id: "aurora", label: "Aurora" },
  { id: "waves", label: "Valuri" },
  { id: "forest", label: "Pădure" },
  { id: "sunset", label: "Apus" },
  { id: "minimal", label: "Minimal" },
  { id: "none", label: "Fără fundal" },
];

function getInitials(profile: Profile | null) {
  const value = profile?.full_name || profile?.username || "U";

  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = Number(params.id);

  const [currentUserId, setCurrentUserId] = useState("");
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [otherUserIsTyping, setOtherUserIsTyping] = useState(false);
  const [otherUserIsOnline, setOtherUserIsOnline] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>(
    {},
  );
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<number, string>>({});
  const [audioUrls, setAudioUrls] = useState<Record<number, string>>({});
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<number, string>>({});
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [menuMessageId, setMenuMessageId] = useState<number | null>(null);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    number | null
  >(null);
  const [deletingMessageId, setDeletingMessageId] = useState<number | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [galleryTab, setGalleryTab] = useState<GalleryTab>("media");
  const [gallerySearch, setGallerySearch] = useState("");
  const [previewDocument, setPreviewDocument] = useState<{
    name: string;
    url: string;
  } | null>(null);
  const [showAppearance, setShowAppearance] = useState(false);
  const [chatTheme, setChatTheme] = useState<ChatTheme>("aurora");
  const [chatWallpaper, setChatWallpaper] = useState<ChatWallpaper>("none");
  const [chatBlur, setChatBlur] = useState(16);
  const [savingAppearance, setSavingAppearance] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const chatViewportRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const latestMessageIdRef = useRef(0);
  const pollingBusyRef = useRef(false);
  const dragDepthRef = useRef(0);

  useEffect(() => {
    function updateChatViewportHeight() {
      const element = chatViewportRef.current;
      if (!element) return;

      const visualViewport = window.visualViewport;
      const visibleHeight = visualViewport?.height ?? window.innerHeight;
      const viewportOffsetTop = visualViewport?.offsetTop ?? 0;

      const mobileHeader = document.querySelector<HTMLElement>(
        ".friends-mobile-header",
      );

      const mobileHeaderBottom = mobileHeader
        ? Math.max(
            0,
            mobileHeader.getBoundingClientRect().bottom - viewportOffsetTop,
          )
        : 0;

      const availableHeight = Math.max(
        320,
        visibleHeight - mobileHeaderBottom,
      );

      element.style.setProperty(
        "--friends-mobile-header-bottom",
        `${mobileHeaderBottom}px`,
      );
      element.style.setProperty(
        "--friends-chat-visible-height",
        `${availableHeight}px`,
      );
    }

    updateChatViewportHeight();

    const visualViewport = window.visualViewport;
    const mobileHeader = document.querySelector<HTMLElement>(
      ".friends-mobile-header",
    );

    let resizeObserver: ResizeObserver | null = null;

    if (typeof ResizeObserver !== "undefined" && mobileHeader) {
      resizeObserver = new ResizeObserver(updateChatViewportHeight);
      resizeObserver.observe(mobileHeader);
    }

    visualViewport?.addEventListener("resize", updateChatViewportHeight);
    visualViewport?.addEventListener("scroll", updateChatViewportHeight);
    window.addEventListener("resize", updateChatViewportHeight);
    window.addEventListener("orientationchange", updateChatViewportHeight);

    return () => {
      resizeObserver?.disconnect();
      visualViewport?.removeEventListener("resize", updateChatViewportHeight);
      visualViewport?.removeEventListener("scroll", updateChatViewportHeight);
      window.removeEventListener("resize", updateChatViewportHeight);
      window.removeEventListener("orientationchange", updateChatViewportHeight);
    };
  }, []);

  const markConversationSeen = useCallback(async () => {
    if (!currentUserId || !Number.isFinite(conversationId)) return;
    if (document.visibilityState !== "visible") return;

    const { error } = await supabase.rpc("mark_conversation_seen", {
      p_conversation_id: conversationId,
    });

    if (error) {
      console.error(
        "Mesajele nu au putut fi marcate ca văzute:",
        error.message,
      );
    }

    const { error: notificationError } = await supabase.rpc(
      "mark_message_notifications_read",
      {
        p_conversation_id: conversationId,
      },
    );

    if (notificationError) {
      console.error(
        "Notificările mesajelor nu au putut fi marcate ca citite:",
        notificationError.message,
      );
    }
  }, [conversationId, currentUserId]);

  useEffect(() => {
    if (!Number.isFinite(conversationId) || conversationId <= 0) {
      router.replace("/messages");
      return;
    }

    let cancelled = false;

    async function loadConversation() {
      setLoading(true);
      setErrorMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      if (cancelled) return;
      setCurrentUserId(user.id);

      const membersResult = await supabase
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", conversationId);

      if (cancelled) return;

      if (membersResult.error) {
        setErrorMessage(
          `Conversația nu a putut fi încărcată: ${membersResult.error.message}`,
        );
        setLoading(false);
        return;
      }

      const memberIds = (membersResult.data || []).map(
        (member) => member.user_id as string,
      );

      if (!memberIds.includes(user.id)) {
        setErrorMessage("Nu ai acces la această conversație.");
        setLoading(false);
        return;
      }

      const otherUserId = memberIds.find((id) => id !== user.id);

      if (otherUserId) {
        const profileResult = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .eq("id", otherUserId)
          .single();

        if (!cancelled && !profileResult.error) {
          setOtherProfile(profileResult.data as Profile);
        }
      }

      const messagesResult = await supabase
        .from("messages")
        .select(
          "id, conversation_id, sender_id, content, image_path, attachment_path, attachment_name, attachment_type, attachment_size, audio_path, audio_duration, location_lat, location_lng, location_label, edited_at, pinned_at, pinned_by, reply_to_message_id, created_at, seen_at",
        )
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (cancelled) return;

      if (messagesResult.error) {
        setErrorMessage(
          `Mesajele nu au putut fi încărcate: ${messagesResult.error.message}`,
        );
      } else {
        const loadedMessages = (messagesResult.data || []) as Message[];
        setMessages(loadedMessages);

        const messageIds = loadedMessages.map((message) => message.id);

        if (messageIds.length > 0) {
          const reactionsResult = await supabase
            .from("message_reactions")
            .select("id, message_id, user_id, emoji, created_at")
            .in("message_id", messageIds)
            .order("created_at", { ascending: true });

          if (!cancelled && !reactionsResult.error) {
            setReactions((reactionsResult.data || []) as Reaction[]);
          }
        } else {
          setReactions([]);
        }
      }

      setLoading(false);
    }

    loadConversation();

    return () => {
      cancelled = true;
    };
  }, [conversationId, router]);

  useEffect(() => {
    if (!currentUserId || !Number.isFinite(conversationId)) return;

    let cancelled = false;

    async function loadAppearance() {
      const localKey = `friends-chat-appearance-${conversationId}-${currentUserId}`;
      const cached = window.localStorage.getItem(localKey);

      if (cached) {
        try {
          const parsed = JSON.parse(cached) as Partial<ChatAppearancePreference>;
          if (parsed.theme) setChatTheme(parsed.theme);
          if (parsed.wallpaper) {
            setChatWallpaper(parsed.wallpaper === "aurora" ? "none" : parsed.wallpaper);
          }
          if (typeof parsed.blur_strength === "number") setChatBlur(parsed.blur_strength);
        } catch {
          window.localStorage.removeItem(localKey);
        }
      }

      const { data, error } = await supabase
        .from("chat_appearance_preferences")
        .select("conversation_id, user_id, theme, wallpaper, blur_strength")
        .eq("conversation_id", conversationId)
        .eq("user_id", currentUserId)
        .maybeSingle();

      if (cancelled || error || !data) return;

      const preference = data as ChatAppearancePreference;
      setChatTheme(preference.theme || "aurora");
      setChatWallpaper(
        preference.wallpaper === "aurora"
          ? "none"
          : preference.wallpaper || "none",
      );
      setChatBlur(preference.blur_strength ?? 16);
      window.localStorage.setItem(localKey, JSON.stringify(preference));
    }

    void loadAppearance();

    return () => {
      cancelled = true;
    };
  }, [conversationId, currentUserId]);

  async function saveAppearance() {
    if (!currentUserId) return;

    setSavingAppearance(true);
    setErrorMessage("");

    const preference: ChatAppearancePreference = {
      conversation_id: conversationId,
      user_id: currentUserId,
      theme: chatTheme,
      wallpaper: chatWallpaper,
      blur_strength: chatBlur,
    };

    const localKey = `friends-chat-appearance-${conversationId}-${currentUserId}`;
    window.localStorage.setItem(localKey, JSON.stringify(preference));

    const { error } = await supabase
      .from("chat_appearance_preferences")
      .upsert(preference, { onConflict: "conversation_id,user_id" });

    if (error) {
      setErrorMessage(`Aspectul a fost salvat local, dar nu s-a sincronizat: ${error.message}`);
    } else {
      setShowAppearance(false);
    }

    setSavingAppearance(false);
  }

  useEffect(() => {
    if (!currentUserId || loading) return;

    void markConversationSeen();
  }, [currentUserId, loading, markConversationSeen]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void markConversationSeen();
      }
    }

    function handleWindowFocus() {
      void markConversationSeen();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [markConversationSeen]);

  useEffect(() => {
    if (!currentUserId || !Number.isFinite(conversationId)) return;

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
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;

          setMessages((current) =>
            current.some((message) => message.id === newMessage.id)
              ? current
              : [...current, newMessage],
          );

          if (newMessage.sender_id !== currentUserId) {
            setOtherUserIsTyping(false);

            if (document.visibilityState === "visible") {
              void markConversationSeen();
            }
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updatedMessage = payload.new as Message;

          setMessages((current) =>
            current.map((message) =>
              message.id === updatedMessage.id
                ? { ...message, ...updatedMessage }
                : message,
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_reactions",
        },
        (payload) => {
          const newReaction = payload.new as Reaction;

          setReactions((current) => [
            ...current.filter(
              (reaction) =>
                !(
                  reaction.message_id === newReaction.message_id &&
                  reaction.user_id === newReaction.user_id
                ),
            ),
            newReaction,
          ]);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "message_reactions",
        },
        (payload) => {
          const updatedReaction = payload.new as Reaction;

          setReactions((current) =>
            current.map((reaction) =>
              reaction.id === updatedReaction.id ? updatedReaction : reaction,
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "message_reactions",
        },
        (payload) => {
          const deletedReaction = payload.old as Partial<Reaction>;

          setReactions((current) =>
            current.filter((reaction) => reaction.id !== deletedReaction.id),
          );
        },
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const typing = payload as TypingPayload;

        if (!typing || typing.user_id === currentUserId) return;

        setOtherUserIsTyping(Boolean(typing.is_typing));

        if (remoteTypingTimerRef.current) {
          clearTimeout(remoteTypingTimerRef.current);
        }

        if (typing.is_typing) {
          remoteTypingTimerRef.current = setTimeout(() => {
            setOtherUserIsTyping(false);
          }, 2500);
        }
      })
      .on("presence", { event: "sync" }, () => {
        const presenceState = channel.presenceState<PresencePayload>();
        const connectedUsers = Object.values(presenceState).flat();

        setOtherUserIsOnline(
          connectedUsers.some((presence) => presence.user_id !== currentUserId),
        );
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          const trackResult = await channel.track({
            user_id: currentUserId,
            online_at: new Date().toISOString(),
          } satisfies PresencePayload);

          if (trackResult !== "ok") {
            setErrorMessage("Starea online nu a putut fi activată.");
          }
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setErrorMessage(
            "Conexiunea în timp real a fost întreruptă. Reîncarcă pagina.",
          );
        }
      });

    channelRef.current = channel;

    return () => {
      if (typingStopTimerRef.current) {
        clearTimeout(typingStopTimerRef.current);
      }

      if (remoteTypingTimerRef.current) {
        clearTimeout(remoteTypingTimerRef.current);
      }

      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }

      setOtherUserIsOnline(false);
      channelRef.current = null;
      void channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId, markConversationSeen]);

  useEffect(() => {
    latestMessageIdRef.current = messages.reduce(
      (maximum, message) => Math.max(maximum, message.id),
      0,
    );

    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, otherUserIsTyping]);

  useEffect(() => {
    if (
      !currentUserId ||
      !Number.isFinite(conversationId) ||
      conversationId <= 0
    ) {
      return;
    }

    let stopped = false;

    async function fetchNewMessages() {
      if (stopped || pollingBusyRef.current) return;
      if (document.visibilityState !== "visible") return;

      pollingBusyRef.current = true;

      try {
        let query = supabase
          .from("messages")
          .select(
            "id, conversation_id, sender_id, content, image_path, attachment_path, attachment_name, attachment_type, attachment_size, audio_path, audio_duration, location_lat, location_lng, location_label, edited_at, pinned_at, pinned_by, reply_to_message_id, created_at, seen_at",
          )
          .eq("conversation_id", conversationId)
          .order("id", { ascending: true });

        if (latestMessageIdRef.current > 0) {
          query = query.gt("id", latestMessageIdRef.current);
        }

        const { data, error } = await query.limit(50);

        if (error) {
          console.error("Fallback Realtime messages:", error.message);
          return;
        }

        const incomingMessages = (data ?? []) as Message[];

        if (incomingMessages.length === 0) return;

        setMessages((current) => {
          const existingIds = new Set(current.map((message) => message.id));
          const missing = incomingMessages.filter(
            (message) => !existingIds.has(message.id),
          );

          if (missing.length === 0) return current;

          return [...current, ...missing].sort((a, b) => a.id - b.id);
        });

        const newestIncomingId = incomingMessages.reduce(
          (maximum, message) => Math.max(maximum, message.id),
          latestMessageIdRef.current,
        );

        latestMessageIdRef.current = Math.max(
          latestMessageIdRef.current,
          newestIncomingId,
        );

        if (
          incomingMessages.some(
            (message) => message.sender_id !== currentUserId,
          )
        ) {
          setOtherUserIsTyping(false);
          void markConversationSeen();
        }
      } finally {
        pollingBusyRef.current = false;
      }
    }

    void fetchNewMessages();

    const intervalId = window.setInterval(() => {
      void fetchNewMessages();
    }, 800);

    function handleFocus() {
      void fetchNewMessages();
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        void fetchNewMessages();
      }
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stopped = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [conversationId, currentUserId, markConversationSeen]);
  useEffect(() => {
    let cancelled = false;

    async function loadImageUrls() {
      const imageMessages = messages.filter(
        (message) => message.image_path && !imageUrls[message.id],
      );

      if (imageMessages.length === 0) return;

      const newUrls: Record<number, string> = {};

      await Promise.all(
        imageMessages.map(async (message) => {
          if (!message.image_path) return;

          const { data, error } = await supabase.storage
            .from("chat-images")
            .createSignedUrl(message.image_path, 60 * 60);

          if (!error && data?.signedUrl) {
            newUrls[message.id] = data.signedUrl;
          }
        }),
      );

      if (!cancelled && Object.keys(newUrls).length > 0) {
        setImageUrls((current) => ({
          ...current,
          ...newUrls,
        }));
      }
    }

    void loadImageUrls();

    return () => {
      cancelled = true;
    };
  }, [messages, imageUrls]);

  useEffect(() => {
    let cancelled = false;
    async function loadExtraUrls() {
      const files = messages.filter((m) => m.attachment_path && !attachmentUrls[m.id]);
      const audios = messages.filter((m) => m.audio_path && !audioUrls[m.id]);
      const nextFiles: Record<number, string> = {};
      const nextAudios: Record<number, string> = {};
      await Promise.all(files.map(async (m) => {
        if (!m.attachment_path) return;
        const { data } = await supabase.storage.from("chat-files").createSignedUrl(m.attachment_path, 3600);
        if (data?.signedUrl) nextFiles[m.id] = data.signedUrl;
      }));
      await Promise.all(audios.map(async (m) => {
        if (!m.audio_path) return;
        const { data } = await supabase.storage.from("chat-audio").createSignedUrl(m.audio_path, 3600);
        if (data?.signedUrl) nextAudios[m.id] = data.signedUrl;
      }));
      if (!cancelled) {
        if (Object.keys(nextFiles).length) setAttachmentUrls((v) => ({ ...v, ...nextFiles }));
        if (Object.keys(nextAudios).length) setAudioUrls((v) => ({ ...v, ...nextAudios }));
      }
    }
    void loadExtraUrls();
    return () => { cancelled = true; };
  }, [messages, attachmentUrls, audioUrls]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Element;

      if (
        showEmojiPicker &&
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(target)
      ) {
        setShowEmojiPicker(false);
      }

      if (menuMessageId !== null && !target.closest("[data-message-menu]")) {
        setMenuMessageId(null);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowEmojiPicker(false);
        setMenuMessageId(null);
        setReplyToMessage(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showEmojiPicker, menuMessageId]);

  async function broadcastTyping(isTyping: boolean) {
    const channel = channelRef.current;

    if (!channel || !currentUserId) return;

    await channel.send({
      type: "broadcast",
      event: "typing",
      payload: {
        user_id: currentUserId,
        is_typing: isTyping,
      } satisfies TypingPayload,
    });
  }

  function handleTextChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setText(value);

    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
    }

    if (!value.trim()) {
      void broadcastTyping(false);
      return;
    }

    void broadcastTyping(true);

    typingStopTimerRef.current = setTimeout(() => {
      void broadcastTyping(false);
    }, 1200);
  }

  function handleEmojiClick(emojiData: EmojiClickData) {
    const input = inputRef.current;
    const emoji = emojiData.emoji;

    if (!input) {
      setText((current) => `${current}${emoji}`);
      setShowEmojiPicker(false);
      return;
    }

    const selectionStart = input.selectionStart ?? text.length;
    const selectionEnd = input.selectionEnd ?? selectionStart;
    const nextText =
      text.slice(0, selectionStart) + emoji + text.slice(selectionEnd);

    setText(nextText);
    setShowEmojiPicker(false);
    void broadcastTyping(true);

    requestAnimationFrame(() => {
      const nextCursorPosition = selectionStart + emoji.length;
      input.focus();
      input.setSelectionRange(nextCursorPosition, nextCursorPosition);
    });

    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
    }

    typingStopTimerRef.current = setTimeout(() => {
      void broadcastTyping(false);
    }, 1200);
  }
  function addPendingFiles(files: File[]) {
    if (!files.length) return;

    const accepted: PendingUpload[] = [];
    const rejected: string[] = [];

    for (const file of files) {
      const isImage = file.type.startsWith("image/");
      const maximumSize = isImage ? 10 * 1024 * 1024 : 25 * 1024 * 1024;

      if (file.size > maximumSize) {
        rejected.push(
          `${file.name} depășește limita de ${isImage ? "10 MB" : "25 MB"}.`,
        );
        continue;
      }

      accepted.push({
        id: crypto.randomUUID(),
        file,
        kind: isImage ? "image" : "file",
        previewUrl: isImage ? URL.createObjectURL(file) : null,
      });
    }

    if (accepted.length) {
      setPendingUploads((current) => [...current, ...accepted]);
      setErrorMessage("");
    }

    if (rejected.length) {
      setErrorMessage(rejected.join(" "));
    }
  }

  function removePendingUpload(uploadId: string) {
    setPendingUploads((current) => {
      const removed = current.find((item) => item.id === uploadId);

      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }

      return current.filter((item) => item.id !== uploadId);
    });

    setUploadProgress((current) => {
      const next = { ...current };
      delete next[uploadId];
      return next;
    });
  }

  function clearPendingUploads() {
    setPendingUploads((current) => {
      current.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      return [];
    });
    setUploadProgress({});
  }

  function handleImageSelect(event: ChangeEvent<HTMLInputElement>) {
    addPendingFiles(Array.from(event.target.files || []));
    event.target.value = "";
  }

  function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    addPendingFiles(Array.from(event.target.files || []));
    event.target.value = "";
  }

  function handleDragEnter(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;

    if (event.dataTransfer.types.includes("Files")) {
      setIsDraggingFiles(true);
    }
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);

    if (dragDepthRef.current === 0) {
      setIsDraggingFiles(false);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDraggingFiles(false);

    addPendingFiles(Array.from(event.dataTransfer.files || []));
  }

  function handleComposerPaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const pastedFiles = Array.from(event.clipboardData.files || []).filter(
      (file) => file.type.startsWith("image/"),
    );

    if (!pastedFiles.length) return;

    event.preventDefault();
    addPendingFiles(pastedFiles);
  }

  async function sendLocation() {
    if (!navigator.geolocation || !currentUserId || sending) {
      setErrorMessage("Localizarea nu este disponibilă în acest browser.");
      return;
    }
    setSending(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      const { data, error } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        content: "📍 Locație distribuită",
        location_lat: latitude,
        location_lng: longitude,
        location_label: "Locația mea",
        reply_to_message_id: replyToMessage?.id ?? null,
      }).select("id, conversation_id, sender_id, content, image_path, attachment_path, attachment_name, attachment_type, attachment_size, audio_path, audio_duration, location_lat, location_lng, location_label, edited_at, pinned_at, pinned_by, reply_to_message_id, created_at, seen_at" ).single();
      if (error) setErrorMessage(`Locația nu a putut fi trimisă: ${error.message}`);
      else setMessages((v) => v.some((m) => m.id === data.id) ? v : [...v, data as Message]);
      setReplyToMessage(null);
      setSending(false);
    }, (error) => {
      setErrorMessage(`Localizarea nu a putut fi obținută: ${error.message}`);
      setSending(false);
    }, { enableHighAccuracy: true, timeout: 12000 });
  }

  async function toggleRecording() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordingChunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) recordingChunksRef.current.push(event.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        setIsRecording(false);
        const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (!blob.size) return;
        setSending(true);
        const path = `${conversationId}/${currentUserId}/${crypto.randomUUID()}.webm`;
        const upload = await supabase.storage.from("chat-audio").upload(path, blob, { contentType: blob.type, upsert: false });
        if (upload.error) setErrorMessage(`Mesajul vocal nu a putut fi încărcat: ${upload.error.message}`);
        else {
          const result = await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: currentUserId, content: "", audio_path: path, audio_duration: recordingSeconds, reply_to_message_id: replyToMessage?.id ?? null }).select("id, conversation_id, sender_id, content, image_path, attachment_path, attachment_name, attachment_type, attachment_size, audio_path, audio_duration, location_lat, location_lng, location_label, edited_at, pinned_at, pinned_by, reply_to_message_id, created_at, seen_at" ).single();
          if (result.error) setErrorMessage(`Mesajul vocal nu a putut fi trimis: ${result.error.message}`);
          else setMessages((v) => v.some((m) => m.id === result.data.id) ? v : [...v, result.data as Message]);
        }
        setRecordingSeconds(0); setReplyToMessage(null); setSending(false);
      };
      recorder.start(); mediaRecorderRef.current = recorder; setIsRecording(true); setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((v) => v + 1), 1000);
    } catch (error) {
      setErrorMessage("Microfonul nu a putut fi accesat. Verifică permisiunea browserului.");
    }
  }

  async function saveEdit() {
    if (!editingMessage || !text.trim()) return;
    const { error } = await supabase.from("messages").update({ content: text.trim(), edited_at: new Date().toISOString() }).eq("id", editingMessage.id).eq("sender_id", currentUserId);
    if (error) setErrorMessage(`Mesajul nu a putut fi editat: ${error.message}`);
    else { setMessages((v) => v.map((m) => m.id === editingMessage.id ? { ...m, content: text.trim(), edited_at: new Date().toISOString() } : m)); setText(""); setEditingMessage(null); }
  }

  async function togglePin(message: Message) {
    const pinned = Boolean(message.pinned_at);
    const { error } = await supabase.from("messages").update({ pinned_at: pinned ? null : new Date().toISOString(), pinned_by: pinned ? null : currentUserId }).eq("id", message.id);
    if (error) setErrorMessage(`Mesajul nu a putut fi ${pinned ? "desprins" : "fixat"}: ${error.message}`);
    setMenuMessageId(null);
  }

  function scrollToMessage(messageId: number) {
    const element = messageRefs.current[messageId];

    if (!element) {
      setErrorMessage(
        "Mesajul original nu mai este disponibil în conversație.",
      );
      return;
    }

    element.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMessageId(messageId);

    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }

    highlightTimerRef.current = setTimeout(() => {
      setHighlightedMessageId(null);
    }, 1800);
  }

  async function toggleReaction(messageId: number, emoji: string) {
    if (!currentUserId) return;

    setMenuMessageId(null);
    setErrorMessage("");

    const existingReaction = reactions.find(
      (reaction) =>
        reaction.message_id === messageId && reaction.user_id === currentUserId,
    );

    if (existingReaction?.emoji === emoji) {
      const { error } = await supabase
        .from("message_reactions")
        .delete()
        .eq("id", existingReaction.id)
        .eq("user_id", currentUserId);

      if (error) {
        setErrorMessage(`Reacția nu a putut fi eliminată: ${error.message}`);
        return;
      }

      setReactions((current) =>
        current.filter((reaction) => reaction.id !== existingReaction.id),
      );
      return;
    }

    const { data, error } = await supabase
      .from("message_reactions")
      .upsert(
        {
          message_id: messageId,
          user_id: currentUserId,
          emoji,
        },
        { onConflict: "message_id,user_id" },
      )
      .select("id, message_id, user_id, emoji, created_at")
      .single();

    if (error) {
      setErrorMessage(`Reacția nu a putut fi salvată: ${error.message}`);
      return;
    }

    const savedReaction = data as Reaction;

    setReactions((current) => [
      ...current.filter(
        (reaction) =>
          !(
            reaction.message_id === messageId &&
            reaction.user_id === currentUserId
          ),
      ),
      savedReaction,
    ]);
  }

  async function deleteMessageForMe(messageId: number) {
    if (!currentUserId || deletingMessageId !== null) return;

    setDeletingMessageId(messageId);
    setMenuMessageId(null);
    setErrorMessage("");

    const { error } = await supabase.from("message_deletions").insert({
      message_id: messageId,
      user_id: currentUserId,
    });

    if (error) {
      setErrorMessage(
        `Mesajul nu a putut fi șters pentru tine: ${error.message}`,
      );
      setDeletingMessageId(null);
      return;
    }

    setMessages((current) =>
      current.filter((message) => message.id !== messageId),
    );

    setImageUrls((current) => {
      const nextUrls = { ...current };
      delete nextUrls[messageId];
      return nextUrls;
    });

    setDeletingMessageId(null);
  }
  async function deleteMessageForEveryone(message: Message) {
    if (!currentUserId || deletingMessageId !== null) return;

    setDeletingMessageId(message.id);
    setMenuMessageId(null);
    setErrorMessage("");

    try {
      if (message.attachment_path) await supabase.storage.from("chat-files").remove([message.attachment_path]);
      if (message.audio_path) await supabase.storage.from("chat-audio").remove([message.audio_path]);
      if (message.image_path) {
        const { error: storageError } = await supabase.storage
          .from("chat-images")
          .remove([message.image_path]);

        if (storageError) {
          setErrorMessage(
            `Fotografia nu a putut fi ștearsă: ${storageError.message}`,
          );
          return;
        }
      }

      const { error } = await supabase
        .from("messages")
        .update({
          content: "Mesaj șters",
          image_path: null,
          attachment_path: null,
          attachment_name: null,
          attachment_type: null,
          attachment_size: null,
          audio_path: null,
          audio_duration: null,
          location_lat: null,
          location_lng: null,
          location_label: null,
          deleted_for_everyone: true,
          deleted_at: new Date().toISOString(),
        })
        .eq("id", message.id)
        .eq("sender_id", currentUserId);

      if (error) {
        setErrorMessage(
          `Mesajul nu a putut fi șters pentru toată lumea: ${error.message}`,
        );
      }
    } finally {
      setDeletingMessageId(null);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = text.trim();
    const uploads = [...pendingUploads];

    if (editingMessage) {
      await saveEdit();
      return;
    }

    if ((!content && uploads.length === 0) || !currentUserId || sending) return;

    setSending(true);
    setErrorMessage("");

    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
    }

    void broadcastTyping(false);

    const insertedMessages: Message[] = [];
    const storedFiles: Array<{
      bucket: "chat-images" | "chat-files";
      path: string;
    }> = [];

    try {
      if (uploads.length === 0) {
        const result = await supabase
          .from("messages")
          .insert({
            conversation_id: conversationId,
            sender_id: currentUserId,
            content,
            reply_to_message_id: replyToMessage?.id ?? null,
          })
          .select(
            "id, conversation_id, sender_id, content, image_path, attachment_path, attachment_name, attachment_type, attachment_size, audio_path, audio_duration, location_lat, location_lng, location_label, edited_at, pinned_at, pinned_by, reply_to_message_id, created_at, seen_at",
          )
          .single();

        if (result.error) {
          setErrorMessage(`Mesajul nu a fost trimis: ${result.error.message}`);
          return;
        }

        insertedMessages.push(result.data as Message);
      } else {
        for (let index = 0; index < uploads.length; index += 1) {
          const upload = uploads[index];
          const file = upload.file;

          setUploadProgress((current) => ({
            ...current,
            [upload.id]: 8,
          }));

          let imagePath: string | null = null;
          let attachmentPath: string | null = null;

          if (upload.kind === "image") {
            const originalExtension =
              file.name.split(".").pop()?.toLowerCase() || "jpg";
            const safeExtension = originalExtension.replace(/[^a-z0-9]/g, "");
            const fileName = `${crypto.randomUUID()}.${safeExtension || "jpg"}`;
            imagePath = `${conversationId}/${currentUserId}/${fileName}`;

            setUploadProgress((current) => ({
              ...current,
              [upload.id]: 30,
            }));

            const storageResult = await supabase.storage
              .from("chat-images")
              .upload(imagePath, file, {
                cacheControl: "3600",
                contentType: file.type,
                upsert: false,
              });

            if (storageResult.error) {
              throw new Error(
                `${file.name}: ${storageResult.error.message}`,
              );
            }

            storedFiles.push({ bucket: "chat-images", path: imagePath });
          } else {
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            attachmentPath = `${conversationId}/${currentUserId}/${crypto.randomUUID()}-${safeName}`;

            setUploadProgress((current) => ({
              ...current,
              [upload.id]: 30,
            }));

            const storageResult = await supabase.storage
              .from("chat-files")
              .upload(attachmentPath, file, {
                contentType: file.type || "application/octet-stream",
                upsert: false,
              });

            if (storageResult.error) {
              throw new Error(
                `${file.name}: ${storageResult.error.message}`,
              );
            }

            storedFiles.push({ bucket: "chat-files", path: attachmentPath });
          }

          setUploadProgress((current) => ({
            ...current,
            [upload.id]: 82,
          }));

          const result = await supabase
            .from("messages")
            .insert({
              conversation_id: conversationId,
              sender_id: currentUserId,
              content: index === 0 ? content : "",
              image_path: imagePath,
              attachment_path: attachmentPath,
              attachment_name: upload.kind === "file" ? file.name : null,
              attachment_type: upload.kind === "file" ? file.type : null,
              attachment_size: upload.kind === "file" ? file.size : null,
              reply_to_message_id:
                index === 0 ? replyToMessage?.id ?? null : null,
            })
            .select(
              "id, conversation_id, sender_id, content, image_path, attachment_path, attachment_name, attachment_type, attachment_size, audio_path, audio_duration, location_lat, location_lng, location_label, edited_at, pinned_at, pinned_by, reply_to_message_id, created_at, seen_at",
            )
            .single();

          if (result.error) {
            throw new Error(`${file.name}: ${result.error.message}`);
          }

          insertedMessages.push(result.data as Message);

          setUploadProgress((current) => ({
            ...current,
            [upload.id]: 100,
          }));
        }
      }

      setMessages((current) => {
        const existingIds = new Set(current.map((message) => message.id));
        return [
          ...current,
          ...insertedMessages.filter((message) => !existingIds.has(message.id)),
        ];
      });

      setText("");
      clearPendingUploads();
      setReplyToMessage(null);

      if (imageInputRef.current) imageInputRef.current.value = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      console.error(error);

      for (const storedFile of storedFiles) {
        await supabase.storage
          .from(storedFile.bucket)
          .remove([storedFile.path]);
      }

      setErrorMessage(
        error instanceof Error
          ? `Trimiterea nu a reușit: ${error.message}`
          : "A apărut o eroare neașteptată la trimitere.",
      );
    } finally {
      setSending(false);
    }
  }


  useEffect(() => {
    return () => {
      pendingUploads.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, [pendingUploads]);

  const galleryItems = useMemo(() => {
    const query = gallerySearch.trim().toLowerCase();

    return messages
      .filter((message) => {
        if (galleryTab === "media") return Boolean(message.image_path);
        if (galleryTab === "audio") return Boolean(message.audio_path);
        return Boolean(message.attachment_path);
      })
      .filter((message) => {
        if (!query) return true;

        const searchable = [
          message.content,
          message.attachment_name,
          message.attachment_type,
          new Date(message.created_at).toLocaleDateString("ro-RO"),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(query);
      })
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime(),
      );
  }, [gallerySearch, galleryTab, messages]);

  const galleryCounts = useMemo(
    () => ({
      media: messages.filter((message) => message.image_path).length,
      documents: messages.filter((message) => message.attachment_path).length,
      audio: messages.filter((message) => message.audio_path).length,
    }),
    [messages],
  );

  function isPdfAttachment(message: Message) {
    return (
      message.attachment_type === "application/pdf" ||
      message.attachment_name?.toLowerCase().endsWith(".pdf") === true
    );
  }

  function openDocumentPreview(message: Message) {
    const url = attachmentUrls[message.id];

    if (!url) {
      setErrorMessage("Fișierul se pregătește. Încearcă din nou într-o clipă.");
      return;
    }

    if (!isPdfAttachment(message)) {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
      return;
    }

    setErrorMessage("");
    setPreviewDocument({
      name: message.attachment_name || "Document PDF",
      url,
    });
  }

  const lastMessageSentByMeId =
    [...messages]
      .reverse()
      .find((message) => message.sender_id === currentUserId)?.id ?? null;

  if (loading) {
    return (
      <main className="chat-theme-page friends-conversation-page min-h-screen px-4 py-8">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow">
          Se încarcă conversația...
        </div>
      </main>
    );
  }

  return (
    <main
      ref={chatViewportRef}
      className="chat-theme-page friends-conversation-page min-h-screen px-4 py-6"
      data-chat-wallpaper={chatWallpaper}
    >
      <div
        className="aurora-chat-shell relative mx-auto flex h-[calc(100vh-3rem)] max-w-4xl flex-col overflow-hidden rounded-3xl shadow-2xl"
          data-chat-wallpaper={chatWallpaper}
        style={{ "--chat-blur": `${chatBlur}px` } as React.CSSProperties}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDraggingFiles && (
          <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-emerald-950/85 p-6 backdrop-blur-sm">
            <div className="rounded-3xl border-2 border-dashed border-lime-300 bg-white/10 px-10 py-12 text-center text-white shadow-2xl">
              <div className="mb-3 text-5xl">📥</div>
              <p className="text-xl font-black">Lasă fișierele aici</p>
              <p className="mt-1 text-sm text-emerald-100">
                Fotografiile și documentele vor fi pregătite pentru trimitere.
              </p>
            </div>
          </div>
        )}
        <header className="aurora-chat-header flex items-center gap-3 border-b p-4">
          <button
            type="button"
            onClick={() => router.push("/messages")}
            className="rounded-lg border px-3 py-2"
            aria-label="Înapoi la conversații"
          >
            ←
          </button>

          <div className="relative">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-emerald-600 font-bold text-white">
              {otherProfile?.avatar_url ? (
                <img
                  src={otherProfile.avatar_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                getInitials(otherProfile)
              )}
            </div>

            <span
              className={`aurora-presence-dot absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white ${
                otherUserIsOnline ? "is-online" : "is-offline"
              }`}
              aria-label={otherUserIsOnline ? "Online" : "Offline"}
              title={otherUserIsOnline ? "Online" : "Offline"}
            />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="truncate font-bold text-gray-900">
              {otherProfile?.full_name ||
                otherProfile?.username ||
                "Conversație"}
            </h1>

            <p
              className={`text-sm ${
                otherUserIsTyping
                  ? "text-lime-400"
                  : otherUserIsOnline
                    ? "text-green-600"
                    : "text-gray-500"
              }`}
            >
              {otherUserIsTyping
                ? "Scrie..."
                : otherUserIsOnline
                  ? "Online"
                  : "Offline"}
            </p>
          </div>

          <ConversationCallMenu
            disabled={!otherProfile?.id || !currentUserId}
            onStartCall={(kind) => {
              if (!otherProfile?.id) {
                setErrorMessage("Profilul persoanei nu este încă disponibil.");
                return;
              }

              setErrorMessage("");

              requestGlobalCall({
                conversationId,
                kind,
                contact: {
                  id: otherProfile.id,
                  name:
                    otherProfile.full_name ||
                    otherProfile.username ||
                    "Prieten Friends",
                  avatarUrl: otherProfile.avatar_url,
                },
              });
            }}
            onOpenMedia={() => setShowMediaGallery(true)}
            onOpenAppearance={() => setShowAppearance(true)}
          />
        </header>

        {errorMessage && (
          <div className="border-b bg-red-50 p-3 text-red-700">
            {errorMessage}
          </div>
        )}

        <section className="aurora-chat-messages flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && !otherUserIsTyping && (
            <p className="py-10 text-center text-gray-500">
              Nu există mesaje încă. Trimite primul mesaj.
            </p>
          )}

          {messages.map((message) => {
            const mine = message.sender_id === currentUserId;
            const repliedMessage = message.reply_to_message_id
              ? (messages.find(
                  (candidate) => candidate.id === message.reply_to_message_id,
                ) ?? null)
              : null;
            const messageReactions = reactions.filter(
              (reaction) => reaction.message_id === message.id,
            );
            const groupedReactions = REACTION_EMOJIS.map((emoji) => ({
              emoji,
              count: messageReactions.filter(
                (reaction) => reaction.emoji === emoji,
              ).length,
              reactedByMe: messageReactions.some(
                (reaction) =>
                  reaction.emoji === emoji &&
                  reaction.user_id === currentUserId,
              ),
            })).filter((group) => group.count > 0);
            const isDeletedForEveryone =
              message.content === "Mesaj șters" && !message.image_path;
            const showSeen =
              mine &&
              !isDeletedForEveryone &&
              message.id === lastMessageSentByMeId &&
              Boolean(message.seen_at);

            return (
              <div
                key={message.id}
                ref={(element) => {
                  messageRefs.current[message.id] = element;
                }}
                className={`flex rounded-xl transition-all duration-300 ${
                  mine ? "justify-end" : "justify-start"
                } ${
                  highlightedMessageId === message.id
                    ? "bg-yellow-100 ring-2 ring-yellow-300"
                    : ""
                }`}
              >
                <div className="max-w-[75%]">
                  <div className="relative">
                    <div
                      className={`aurora-message-bubble rounded-2xl px-4 py-2 ${
                        mine ? "is-mine text-white" : "is-theirs text-gray-900"
                      }`}
                    >
                      {message.reply_to_message_id && (
                        <button
                          type="button"
                          onClick={() =>
                            scrollToMessage(message.reply_to_message_id!)
                          }
                          className={`mb-2 block w-full rounded-lg border-l-4 p-2 text-left text-sm transition hover:brightness-95 ${
                            mine
                              ? "border-emerald-200 bg-emerald-500/40 text-emerald-50"
                              : "border-emerald-400 bg-gray-100 text-gray-700"
                          }`}
                        >
                          <p className="mb-0.5 text-xs font-semibold">
                            Răspuns la mesaj
                          </p>
                          <p className="line-clamp-2 break-words">
                            {repliedMessage
                              ? repliedMessage.content || "📷 Fotografie"
                              : "Mesajul original nu mai este disponibil"}
                          </p>
                        </button>
                      )}

                      {message.image_path && imageUrls[message.id] && (
                        <img
                          src={imageUrls[message.id]}
                          alt="Fotografie trimisă în conversație"
                          className="mb-2 max-h-96 w-full max-w-sm cursor-pointer rounded-xl object-contain transition hover:opacity-90"
                          onClick={() =>
                            setFullscreenImage(imageUrls[message.id])
                          }
                        />
                      )}

                      {message.image_path && !imageUrls[message.id] && (
                        <div className="mb-2 flex h-40 w-60 items-center justify-center rounded-xl bg-gray-200 text-sm text-gray-500">
                          Se încarcă fotografia...
                        </div>
                      )}

                      {message.pinned_at && <div className={`mb-2 text-xs font-semibold ${mine ? "text-yellow-100" : "text-yellow-700"}`}>📌 Mesaj fixat</div>}

                      {message.audio_path && audioUrls[message.id] && (
                        <div className="mb-2"><audio controls preload="metadata" src={audioUrls[message.id]} className="max-w-full" /><p className="mt-1 text-xs opacity-80">🎤 Mesaj vocal {message.audio_duration ? `• ${message.audio_duration}s` : ""}</p></div>
                      )}

                      {message.attachment_path && (
                        <div
                          className={`mb-2 rounded-xl border p-3 ${
                            mine
                              ? "border-emerald-300 bg-emerald-500/40"
                              : "bg-gray-50"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-3xl">
                              {isPdfAttachment(message) ? "📄" : "📎"}
                            </span>

                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold">
                                {message.attachment_name || "Fișier"}
                              </p>
                              <p className="text-xs opacity-75">
                                {message.attachment_size
                                  ? `${(
                                      message.attachment_size /
                                      1024 /
                                      1024
                                    ).toFixed(2)} MB`
                                  : "Se pregătește..."}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => openDocumentPreview(message)}
                              disabled={!attachmentUrls[message.id]}
                              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
                                mine
                                  ? "bg-white/90 text-emerald-800 hover:bg-white"
                                  : "bg-emerald-600 text-white hover:bg-emerald-500"
                              }`}
                            >
                              {isPdfAttachment(message)
                                ? "👁 Previzualizare"
                                : "Deschide"}
                            </button>

                            {attachmentUrls[message.id] && (
                              <a
                                href={attachmentUrls[message.id]}
                                target="_blank"
                                rel="noreferrer"
                                download={message.attachment_name || undefined}
                                className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                                  mine
                                    ? "border-white/70 text-white hover:bg-white/10"
                                    : "border-gray-300 text-gray-700 hover:bg-white"
                                }`}
                              >
                                ⬇ Descarcă
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {message.location_lat !== null && message.location_lng !== null && (
                        <a href={`https://www.google.com/maps?q=${message.location_lat},${message.location_lng}`} target="_blank" rel="noreferrer" className={`mb-2 block rounded-xl border p-3 ${mine ? "border-emerald-300 bg-emerald-500/40" : "bg-gray-50"}`}>
                          <p className="font-semibold">📍 {message.location_label || "Locație"}</p><p className="text-xs opacity-80">Deschide în Google Maps</p>
                        </a>
                      )}

                      {message.content && (
                        <p className="whitespace-pre-wrap break-words">
                          {message.content}
                        </p>
                      )}

                      <p
                        className={`mt-1 text-xs ${
                          mine ? "text-emerald-100" : "text-gray-400"
                        }`}
                      >
                        {new Date(message.created_at).toLocaleTimeString(
                          "ro-RO",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}{message.edited_at ? " · editat" : ""}
                      </p>
                      {!isDeletedForEveryone && (
                        <button
                          type="button"
                          data-message-menu
                          onClick={() =>
                            setMenuMessageId((current) =>
                              current === message.id ? null : message.id,
                            )
                          }
                          className={`absolute top-1 rounded-full px-2 py-1 text-lg ${
                            mine
                              ? "-left-9 text-gray-500 hover:bg-gray-200"
                              : "-right-9 text-gray-500 hover:bg-gray-200"
                          }`}
                          aria-label="Opțiuni mesaj"
                          title="Opțiuni mesaj"
                        >
                          ⋮
                        </button>
                      )}

                      {menuMessageId === message.id && (
                        <div
                          data-message-menu
                          className={`absolute top-9 z-20 min-w-52 overflow-hidden rounded-xl border bg-white py-1 text-sm text-gray-800 shadow-lg ${
                            mine ? "right-0" : "left-0"
                          }`}
                        >
                          <div className="flex items-center justify-center gap-1 border-b px-2 py-2">
                            {REACTION_EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() =>
                                  void toggleReaction(message.id, emoji)
                                }
                                className="rounded-lg px-1.5 py-1 text-xl hover:bg-gray-100"
                                aria-label={`Reacționează cu ${emoji}`}
                                title={`Reacționează cu ${emoji}`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setReplyToMessage(message);
                              setMenuMessageId(null);
                              inputRef.current?.focus();
                            }}
                            className="block w-full px-4 py-2 text-left hover:bg-gray-100"
                          >
                            Răspunde
                          </button>
                          <button type="button" onClick={() => void togglePin(message)} className="block w-full px-4 py-2 text-left hover:bg-gray-100">{message.pinned_at ? "Desprinde mesajul" : "Fixează mesajul"}</button>
                          {mine && !message.image_path && !message.attachment_path && !message.audio_path && message.location_lat === null && (
                            <button type="button" onClick={() => { setEditingMessage(message); setText(message.content); setMenuMessageId(null); inputRef.current?.focus(); }} className="block w-full px-4 py-2 text-left hover:bg-gray-100">Editează</button>
                          )}
                          <button
                            type="button"
                            onClick={() => void deleteMessageForMe(message.id)}
                            disabled={deletingMessageId === message.id}
                            className="block w-full px-4 py-2 text-left hover:bg-gray-100 disabled:opacity-50"
                          >
                            {deletingMessageId === message.id
                              ? "Se șterge..."
                              : "Șterge pentru mine"}
                          </button>

                          {mine && (
                            <button
                              type="button"
                              onClick={() =>
                                void deleteMessageForEveryone(message)
                              }
                              disabled={deletingMessageId === message.id}
                              className="block w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              {deletingMessageId === message.id
                                ? "Se șterge..."
                                : "Șterge pentru toată lumea"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {groupedReactions.length > 0 && (
                      <div
                        className={`mt-1 flex flex-wrap gap-1 ${
                          mine ? "justify-end" : "justify-start"
                        }`}
                      >
                        {groupedReactions.map((group) => (
                          <button
                            key={group.emoji}
                            type="button"
                            onClick={() =>
                              void toggleReaction(message.id, group.emoji)
                            }
                            className={`rounded-full border px-2 py-0.5 text-xs shadow-sm ${
                              group.reactedByMe
                                ? "border-lime-400 bg-emerald-900/70 text-lime-200"
                                : "border-gray-200 bg-white text-gray-700"
                            }`}
                            title={
                              group.reactedByMe
                                ? "Apasă pentru a elimina reacția"
                                : "Apasă pentru a reacționa"
                            }
                          >
                            {group.emoji} {group.count}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {showSeen && (
                    <p className="mt-1 text-right text-xs font-medium text-lime-400">
                      ✓ Văzut
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {otherUserIsTyping && (
            <div className="flex justify-start">
              <div className="aurora-message-bubble is-theirs rounded-2xl px-4 py-2 text-sm text-gray-500">
                Scrie...
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </section>

        {pendingUploads.length > 0 && (
          <div className="border-t bg-white px-4 pt-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-gray-800">
                {pendingUploads.length}{" "}
                {pendingUploads.length === 1 ? "element pregătit" : "elemente pregătite"}
              </p>

              <button
                type="button"
                onClick={clearPendingUploads}
                disabled={sending}
                className="text-xs font-bold text-red-600 hover:underline disabled:opacity-50"
              >
                Elimină toate
              </button>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-3">
              {pendingUploads.map((upload) => {
                const progress = uploadProgress[upload.id] || 0;

                return (
                  <div
                    key={upload.id}
                    className="relative w-44 shrink-0 overflow-hidden rounded-xl border bg-gray-50 p-3"
                  >
                    {upload.kind === "image" && upload.previewUrl ? (
                      <img
                        src={upload.previewUrl}
                        alt="Previzualizare fotografie"
                        className="mb-2 h-24 w-full rounded-lg object-cover"
                      />
                    ) : (
                      <div className="mb-2 flex h-24 items-center justify-center rounded-lg bg-white text-4xl">
                        📎
                      </div>
                    )}

                    <p
                      className="truncate text-xs font-bold text-gray-800"
                      title={upload.file.name}
                    >
                      {upload.file.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-500">
                      {(upload.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>

                    {sending && (
                      <div className="mt-2">
                        <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="mt-1 text-[10px] font-semibold text-emerald-700">
                          {progress >= 100 ? "Trimis" : `${progress}%`}
                        </p>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => removePendingUpload(upload.id)}
                      disabled={sending}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50"
                      aria-label={`Elimină ${upload.file.name}`}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {editingMessage && (
          <div className="border-t bg-yellow-50 px-4 py-2 text-sm"><b>Editezi mesajul:</b> {editingMessage.content}<button type="button" onClick={() => { setEditingMessage(null); setText(""); }} className="ml-3 font-bold text-red-600">Anulează</button></div>
        )}

        {replyToMessage && (
          <div className="border-t bg-emerald-950/70 px-4 py-3">
            <div className="flex items-start justify-between rounded-lg border-l-4 border-lime-400 bg-white p-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-lime-400">
                  Răspunzi la
                </p>

                <p className="truncate text-sm text-gray-700">
                  {replyToMessage.content || "📷 Fotografie"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setReplyToMessage(null)}
                className="ml-3 text-lg font-bold text-gray-500 hover:text-red-600"
              >
                ×
              </button>
            </div>
          </div>
        )}
        <form
          onSubmit={sendMessage}
          className="aurora-chat-composer relative flex items-center gap-3 border-t p-4"
        >
          <div ref={emojiPickerRef} className="relative">
            <button
              type="button"
              onClick={() => setShowEmojiPicker((current) => !current)}
              className="flex h-12 w-12 items-center justify-center rounded-xl border bg-white text-2xl hover:bg-gray-50"
              aria-label="Deschide lista de emoji"
              aria-expanded={showEmojiPicker}
              title="Emoji"
            >
              😊
            </button>

            {showEmojiPicker && (
              <div className="absolute bottom-14 left-0 z-50">
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  width={350}
                  height={430}
                  searchPlaceHolder="Caută emoji..."
                  previewConfig={{ showPreview: false }}
                  lazyLoadEmojis
                />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="flex h-12 w-12 items-center justify-center rounded-xl border bg-white text-2xl hover:bg-gray-50"
            aria-label="Alege o fotografie"
            title="Fotografie"
          >
            📷
          </button>

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
            className="hidden"
          />

          <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-12 w-12 items-center justify-center rounded-xl border bg-white text-2xl hover:bg-gray-50" title="Fișier">📎</button>
          <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />
          <button type="button" onClick={() => void sendLocation()} className="flex h-12 w-12 items-center justify-center rounded-xl border bg-white text-2xl hover:bg-gray-50" title="Locație">📍</button>
          <button type="button" onClick={() => void toggleRecording()} className={`flex h-12 w-12 items-center justify-center rounded-xl border text-2xl ${isRecording ? "bg-red-100 animate-pulse" : "bg-white hover:bg-gray-50"}`} title={isRecording ? "Oprește înregistrarea" : "Mesaj vocal"}>{isRecording ? "⏹️" : "🎤"}</button>
          {isRecording && <span className="text-sm font-semibold text-red-600">{recordingSeconds}s</span>}

          <input
            ref={inputRef}
            type="text"
            inputMode="text"
            enterKeyHint="send"
            value={text}
            onChange={handleTextChange}
            onPaste={handleComposerPaste}
            maxLength={5000}
            placeholder="Scrie un mesaj sau lipește o imagine..."
            autoComplete="off"
            className="min-w-0 flex-1 rounded-xl border px-4 py-3 outline-none focus:border-emerald-400"
          />

          <button
            type="submit"
            disabled={sending || (!text.trim() && pendingUploads.length === 0)}
            className="rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            {sending ? "Se trimite..." : editingMessage ? "Salvează" : "Trimite"}
          </button>
        </form>
      </div>

      {showAppearance && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setShowAppearance(false)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <h2 className="text-2xl font-black text-gray-900">Aspect conversație</h2>
                <p className="text-sm text-gray-500">Aceste setări se aplică numai acestei conversații, nu temei generale din Feed.</p>
              </div>
              <button type="button" onClick={() => setShowAppearance(false)} className="rounded-full bg-gray-100 px-4 py-2 text-xl font-bold text-gray-600 hover:bg-gray-200">×</button>
            </div>

            <div className="max-h-[70vh] space-y-6 overflow-y-auto p-5">
              <section>
                <h3 className="mb-3 font-black text-gray-900">Temă</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {CHAT_THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => {
                        setChatTheme(theme.id);
                        const linkedWallpaper: Record<ChatTheme, ChatWallpaper> = {
                          aurora: "aurora",
                          forest: "forest",
                          ocean: "waves",
                          sunset: "sunset",
                          midnight: "minimal",
                          ice: "waves",
                        };
                        setChatWallpaper(linkedWallpaper[theme.id]);
                      }}
                      className={`aurora-theme-card rounded-2xl border p-4 text-left transition ${chatTheme === theme.id ? "is-selected ring-4 ring-emerald-100" : "hover:-translate-y-0.5"}`}
                      data-preview-theme={theme.id}
                    >
                      <span className="text-2xl">{theme.emoji}</span>
                      <p className="mt-2 font-black">{theme.label}</p>
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-3 font-black text-gray-900">Wallpaper</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {CHAT_WALLPAPERS.map((wallpaper) => (
                    <button
                      key={wallpaper.id}
                      type="button"
                      onClick={() => setChatWallpaper(wallpaper.id)}
                      className={`aurora-wallpaper-card rounded-2xl border p-4 text-left font-bold transition ${chatWallpaper === wallpaper.id ? "is-selected ring-4 ring-emerald-100" : "hover:-translate-y-0.5"}`}
                      data-preview-wallpaper={wallpaper.id}
                    >
                      {wallpaper.label}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-black text-gray-900">Blur glass</h3>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">{chatBlur}px</span>
                </div>
                <input type="range" min="0" max="28" step="2" value={chatBlur} onChange={(event) => setChatBlur(Number(event.target.value))} className="w-full accent-emerald-600" />
              </section>
            </div>

            <div className="flex justify-end gap-3 border-t bg-gray-50 p-4">
              <button type="button" onClick={() => setShowAppearance(false)} className="rounded-xl border bg-white px-4 py-2 font-bold text-gray-700 hover:bg-gray-100">Anulează</button>
              <button type="button" onClick={() => void saveAppearance()} disabled={savingAppearance} className="rounded-xl bg-emerald-600 px-5 py-2 font-bold text-white hover:bg-emerald-500 disabled:opacity-50">{savingAppearance ? "Se salvează..." : "Salvează aspectul"}</button>
            </div>
          </div>
        </div>
      )}

      {showMediaGallery && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
          onClick={() => setShowMediaGallery(false)}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <h2 className="text-2xl font-black text-gray-900">
                  Media conversației
                </h2>
                <p className="text-sm text-gray-500">
                  Fotografii, documente și mesaje vocale într-un singur loc.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowMediaGallery(false)}
                className="rounded-full bg-gray-100 px-4 py-2 text-xl font-bold text-gray-600 hover:bg-gray-200"
                aria-label="Închide galeria"
              >
                ×
              </button>
            </div>

            <div className="border-b p-4">
              <div className="mb-4 flex flex-wrap gap-2">
                {(
                  [
                    ["media", `Fotografii (${galleryCounts.media})`],
                    ["documents", `Documente (${galleryCounts.documents})`],
                    ["audio", `Audio (${galleryCounts.audio})`],
                  ] as const
                ).map(([tab, label]) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setGalleryTab(tab)}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                      galleryTab === tab
                        ? "bg-emerald-600 text-white shadow"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <input
                type="search"
                value={gallerySearch}
                onChange={(event) => setGallerySearch(event.target.value)}
                placeholder="Caută după nume, tip sau dată..."
                className="w-full rounded-xl border px-4 py-3 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
              {galleryItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-gray-500">
                  Nu există elemente în această categorie.
                </div>
              ) : galleryTab === "media" ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {galleryItems.map((message) => (
                    <button
                      key={message.id}
                      type="button"
                      onClick={() => {
                        const url = imageUrls[message.id];
                        if (url) setFullscreenImage(url);
                      }}
                      className="group relative aspect-square overflow-hidden rounded-2xl bg-gray-200"
                    >
                      {imageUrls[message.id] ? (
                        <img
                          src={imageUrls[message.id]}
                          alt="Fotografie din conversație"
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-sm text-gray-500">
                          Se încarcă...
                        </span>
                      )}
                      <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-1 text-[10px] text-white">
                        {new Date(message.created_at).toLocaleDateString("ro-RO")}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {galleryItems.map((message) => {
                    const isAudio = galleryTab === "audio";

                    return (
                      <div
                        key={message.id}
                        className="rounded-2xl border bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-3xl">
                            {isAudio
                              ? "🎤"
                              : isPdfAttachment(message)
                                ? "📄"
                                : "📎"}
                          </span>

                          <div className="min-w-0 flex-1">
                            <p className="truncate font-bold text-gray-900">
                              {isAudio
                                ? "Mesaj vocal"
                                : message.attachment_name || "Fișier"}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(message.created_at).toLocaleString(
                                "ro-RO",
                                {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </p>
                          </div>
                        </div>

                        {isAudio && audioUrls[message.id] && (
                          <audio
                            controls
                            preload="metadata"
                            src={audioUrls[message.id]}
                            className="mt-3 w-full"
                          />
                        )}

                        {!isAudio && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => openDocumentPreview(message)}
                              disabled={!attachmentUrls[message.id]}
                              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                            >
                              {isPdfAttachment(message)
                                ? "👁 Previzualizare"
                                : "Deschide"}
                            </button>

                            {attachmentUrls[message.id] && (
                              <a
                                href={attachmentUrls[message.id]}
                                target="_blank"
                                rel="noreferrer"
                                download={message.attachment_name || undefined}
                                className="rounded-lg border px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                              >
                                ⬇ Descarcă
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {previewDocument &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/90 p-2 backdrop-blur-sm sm:p-4"
            onClick={() => setPreviewDocument(null)}
          >
            <div
              className="flex h-[96dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl sm:h-[92dvh]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="relative z-20 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-white p-3 shadow-sm sm:p-4">
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate font-bold text-gray-900"
                    title={previewDocument.name}
                  >
                    📄 {previewDocument.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    Previzualizare în Friends
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href={previewDocument.url}
                    target="_blank"
                    rel="noreferrer"
                    className="hidden rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100 sm:inline-flex"
                  >
                    ↗ Tab nou
                  </a>

                  <a
                    href={previewDocument.url}
                    download={previewDocument.name}
                    className="rounded-lg border px-3 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
                  >
                    ⬇ Descarcă
                  </a>

                  <button
                    type="button"
                    onClick={() => setPreviewDocument(null)}
                    className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-bold text-white transition hover:bg-gray-700 sm:px-4"
                  >
                    ✕ Închide
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-hidden bg-gray-100">
                <iframe
                  src={previewDocument.url}
                  title={previewDocument.name}
                  className="block h-full w-full border-0 bg-gray-100"
                />
              </div>
            </div>
          </div>,
          document.body,
        )}

      {fullscreenImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setFullscreenImage(null)}
        >
          <button
            type="button"
            onClick={() => setFullscreenImage(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 px-4 py-2 text-2xl text-white transition hover:bg-white/20"
            aria-label="Închide fotografia"
          >
            ×
          </button>

          <img
            src={fullscreenImage}
            alt="Fotografie mărită"
            className="max-h-[90vh] max-w-[95vw] rounded-lg object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </main>
  );
}