"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import type { EmojiClickData } from "emoji-picker-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

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
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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

  const bottomRef = useRef<HTMLDivElement | null>(null);
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
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, otherUserIsTyping]);
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
  function handleImageSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Poți selecta doar imagini.");
      event.target.value = "";
      return;
    }

    setErrorMessage("");
    setSelectedImage(file);
  }
  function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      setErrorMessage("Fișierul este prea mare. Limita este 25 MB.");
      event.target.value = "";
      return;
    }
    setSelectedFile(file);
    setSelectedImage(null);
    setErrorMessage("");
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
    const imageFile = selectedImage;
    const documentFile = selectedFile;

    if (editingMessage) { await saveEdit(); return; }
    if ((!content && !imageFile && !documentFile) || !currentUserId || sending) return;

    setSending(true);
    setErrorMessage("");

    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
    }

    void broadcastTyping(false);

    let uploadedImagePath: string | null = null;
    let uploadedAttachmentPath: string | null = null;

    try {
      if (imageFile) {
        const maximumSize = 10 * 1024 * 1024;

        if (imageFile.size > maximumSize) {
          setErrorMessage(
            "Fotografia este prea mare. Dimensiunea maximă este de 10 MB.",
          );
          return;
        }

        const originalExtension =
          imageFile.name.split(".").pop()?.toLowerCase() || "jpg";

        const safeExtension = originalExtension.replace(/[^a-z0-9]/g, "");

        const fileName = `${crypto.randomUUID()}.${safeExtension || "jpg"}`;

        uploadedImagePath = `${conversationId}/${currentUserId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("chat-images")
          .upload(uploadedImagePath, imageFile, {
            cacheControl: "3600",
            contentType: imageFile.type,
            upsert: false,
          });

        if (uploadError) {
          setErrorMessage(
            `Fotografia nu a putut fi încărcată: ${uploadError.message}`,
          );
          return;
        }
      }

      if (documentFile) {
        const safeName = documentFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        uploadedAttachmentPath = `${conversationId}/${currentUserId}/${crypto.randomUUID()}-${safeName}`;
        const uploaded = await supabase.storage.from("chat-files").upload(uploadedAttachmentPath, documentFile, { contentType: documentFile.type || "application/octet-stream", upsert: false });
        if (uploaded.error) { setErrorMessage(`Fișierul nu a putut fi încărcat: ${uploaded.error.message}`); return; }
      }

      const { data, error: messageError } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          content,
          image_path: uploadedImagePath,
          attachment_path: uploadedAttachmentPath,
          attachment_name: documentFile?.name ?? null,
          attachment_type: documentFile?.type ?? null,
          attachment_size: documentFile?.size ?? null,
          reply_to_message_id: replyToMessage?.id ?? null,
        })
        .select(
          "id, conversation_id, sender_id, content, image_path, attachment_path, attachment_name, attachment_type, attachment_size, audio_path, audio_duration, location_lat, location_lng, location_label, edited_at, pinned_at, pinned_by, reply_to_message_id, created_at, seen_at",
        )
        .single();

      if (messageError) {
        if (uploadedAttachmentPath) await supabase.storage.from("chat-files").remove([uploadedAttachmentPath]);
        if (uploadedImagePath) {
          await supabase.storage
            .from("chat-images")
            .remove([uploadedImagePath]);
        }

        setErrorMessage(`Mesajul nu a fost trimis: ${messageError.message}`);
        return;
      }

      const newMessage = data as Message;

      setMessages((current) =>
        current.some((message) => message.id === newMessage.id)
          ? current
          : [...current, newMessage],
      );

      setText("");
      setSelectedImage(null);
      setSelectedFile(null);
      setReplyToMessage(null);

      if (imageInputRef.current) imageInputRef.current.value = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      console.error(error);

      setErrorMessage("A apărut o eroare neașteptată la trimiterea mesajului.");
    } finally {
      setSending(false);
    }
  }

  const lastMessageSentByMeId =
    [...messages]
      .reverse()
      .find((message) => message.sender_id === currentUserId)?.id ?? null;

  if (loading) {
    return (
      <main className="aurora-page min-h-screen px-4 py-8">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow">
          Se încarcă conversația...
        </div>
      </main>
    );
  }

  return (
    <main className="aurora-page min-h-screen px-4 py-6">
      <div className="mx-auto flex h-[calc(100vh-3rem)] max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow">
        <header className="flex items-center gap-3 border-b p-4">
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
              className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white ${
                otherUserIsOnline ? "bg-green-500" : "bg-gray-400"
              }`}
              aria-label={otherUserIsOnline ? "Online" : "Offline"}
              title={otherUserIsOnline ? "Online" : "Offline"}
            />
          </div>

          <div>
            <h1 className="font-bold text-gray-900">
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
        </header>

        {errorMessage && (
          <div className="border-b bg-red-50 p-3 text-red-700">
            {errorMessage}
          </div>
        )}

        <section className="flex-1 space-y-3 overflow-y-auto bg-gray-50 p-4">
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
                      className={`rounded-2xl px-4 py-2 ${
                        mine
                          ? "bg-emerald-600 text-white"
                          : "border bg-white text-gray-900"
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
                        <a href={attachmentUrls[message.id] || "#"} target="_blank" rel="noreferrer" className={`mb-2 block rounded-xl border p-3 ${mine ? "border-emerald-300 bg-emerald-500/40" : "bg-gray-50"}`}>
                          <p className="font-semibold">📎 {message.attachment_name || "Fișier"}</p>
                          <p className="text-xs opacity-75">{message.attachment_size ? `${(message.attachment_size / 1024 / 1024).toFixed(2)} MB` : "Se pregătește..."}</p>
                        </a>
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
              <div className="rounded-2xl border bg-white px-4 py-2 text-sm text-gray-500">
                Scrie...
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </section>

        {selectedImage && (
          <div className="border-t bg-white px-4 pt-3">
            <div className="flex items-center gap-3 rounded-xl border bg-gray-50 p-3">
              <img
                src={URL.createObjectURL(selectedImage)}
                alt="Previzualizare fotografie"
                className="h-20 w-20 rounded-lg object-cover"
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-800">
                  {selectedImage.name}
                </p>

                <p className="text-xs text-gray-500">
                  Fotografia este pregătită pentru trimitere
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedImage(null);

                  if (imageInputRef.current) {
                    imageInputRef.current.value = "";
                  }
                }}
                className="rounded-lg border px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                Elimină
              </button>
            </div>
          </div>
        )}
        {selectedFile && (
          <div className="border-t bg-white px-4 pt-3"><div className="flex items-center gap-3 rounded-xl border bg-gray-50 p-3"><span className="text-3xl">📎</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{selectedFile.name}</p><p className="text-xs text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p></div><button type="button" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="rounded-lg border px-3 py-1.5 text-sm font-semibold text-red-600">Elimină</button></div></div>
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
          className="relative flex items-center gap-3 border-t p-4"
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
            onChange={handleImageSelect}
            className="hidden"
          />

          <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-12 w-12 items-center justify-center rounded-xl border bg-white text-2xl hover:bg-gray-50" title="Fișier">📎</button>
          <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" />
          <button type="button" onClick={() => void sendLocation()} className="flex h-12 w-12 items-center justify-center rounded-xl border bg-white text-2xl hover:bg-gray-50" title="Locație">📍</button>
          <button type="button" onClick={() => void toggleRecording()} className={`flex h-12 w-12 items-center justify-center rounded-xl border text-2xl ${isRecording ? "bg-red-100 animate-pulse" : "bg-white hover:bg-gray-50"}`} title={isRecording ? "Oprește înregistrarea" : "Mesaj vocal"}>{isRecording ? "⏹️" : "🎤"}</button>
          {isRecording && <span className="text-sm font-semibold text-red-600">{recordingSeconds}s</span>}

          <input
            ref={inputRef}
            value={text}
            onChange={handleTextChange}
            maxLength={5000}
            placeholder="Scrie un mesaj..."
            autoComplete="off"
            className="min-w-0 flex-1 rounded-xl border px-4 py-3 outline-none focus:border-emerald-400"
          />

          <button
            type="submit"
            disabled={sending || (!text.trim() && !selectedImage && !selectedFile)}
            className="rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            {sending ? "..." : editingMessage ? "Salvează" : "Trimite"}
          </button>
        </form>
      </div>
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