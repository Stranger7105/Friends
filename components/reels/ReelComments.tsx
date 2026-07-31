"use client";

import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Check,
  Heart,
  LoaderCircle,
  MessageCircle,
  Pencil,
  Reply,
  Send,
  SmilePlus,
  Trash2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { createNotification } from "@/lib/createNotification";
import styles from "./ReelComments.module.css";

type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type CommentRow = {
  id: string;
  reel_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  updated_at: string | null;
};

type ReelComment = CommentRow & {
  profile: Profile | null;
};

type LikeRow = {
  comment_id: string;
  user_id: string;
};

type ReactionEmoji = "❤️" | "😂" | "😮" | "😢" | "👏" | "🔥";

type ReactionRow = {
  comment_id: string;
  user_id: string;
  emoji: ReactionEmoji;
};

type CommentEngagement = {
  likesCount: number;
  likedByMe: boolean;
  reactions: Partial<Record<ReactionEmoji, number>>;
  myReaction: ReactionEmoji | null;
};

type ReelCommentsProps = {
  open: boolean;
  reelId: string | null;
  currentUserId: string;
  onClose: () => void;
  onCountChange?: (reelId: string, count: number) => void;
};

const REACTIONS: ReactionEmoji[] = ["❤️", "😂", "😮", "😢", "👏", "🔥"];

function displayName(profile: Profile | null) {
  return (
    profile?.full_name?.trim() ||
    profile?.username?.trim() ||
    "Membru Friends"
  );
}

function initials(profile: Profile | null) {
  return displayName(profile)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function formatDate(value: string) {
  const date = new Date(value);
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 1000)
  );

  if (seconds < 30) return "acum";
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}z`;

  return date.toLocaleDateString("ro-RO", {
    day: "2-digit",
    month: "short",
  });
}

function wasEdited(comment: ReelComment) {
  if (!comment.updated_at) return false;

  const created = new Date(comment.created_at).getTime();
  const updated = new Date(comment.updated_at).getTime();

  return Number.isFinite(created) &&
    Number.isFinite(updated) &&
    updated - created > 1000;
}

function emptyEngagement(): CommentEngagement {
  return {
    likesCount: 0,
    likedByMe: false,
    reactions: {},
    myReaction: null,
  };
}

export default function ReelComments({
  open,
  reelId,
  currentUserId,
  onClose,
  onCountChange,
}: ReelCommentsProps) {
  const [comments, setComments] = useState<ReelComment[]>([]);
  const [engagement, setEngagement] = useState<
    Record<string, CommentEngagement>
  >({});
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ReelComment | null>(null);
  const [reactionPickerId, setReactionPickerId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const onCountChangeRef = useRef(onCountChange);

  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  }, [onCountChange]);

  const loadEngagement = useCallback(
    async (commentIds: string[]) => {
      if (!currentUserId || commentIds.length === 0) {
        setEngagement({});
        return;
      }

      const [likesResult, reactionsResult] = await Promise.all([
        supabase
          .from("reel_comment_likes")
          .select("comment_id,user_id")
          .in("comment_id", commentIds),
        supabase
          .from("reel_comment_reactions")
          .select("comment_id,user_id,emoji")
          .in("comment_id", commentIds),
      ]);

      if (likesResult.error || reactionsResult.error) {
        console.warn(
          "Reel comment engagement warning:",
          likesResult.error ?? reactionsResult.error
        );
        return;
      }

      const next: Record<string, CommentEngagement> = {};

      for (const id of commentIds) {
        next[id] = emptyEngagement();
      }

      for (const row of (likesResult.data ?? []) as LikeRow[]) {
        const item = next[row.comment_id] ?? emptyEngagement();
        item.likesCount += 1;

        if (row.user_id === currentUserId) {
          item.likedByMe = true;
        }

        next[row.comment_id] = item;
      }

      for (const row of (reactionsResult.data ?? []) as ReactionRow[]) {
        const item = next[row.comment_id] ?? emptyEngagement();
        item.reactions[row.emoji] = (item.reactions[row.emoji] ?? 0) + 1;

        if (row.user_id === currentUserId) {
          item.myReaction = row.emoji;
        }

        next[row.comment_id] = item;
      }

      setEngagement(next);
    },
    [currentUserId]
  );

  const loadComments = useCallback(
    async (showLoader = false) => {
      if (!reelId) return;

      if (showLoader) setLoading(true);
      setErrorMessage("");

      const { data: rows, error } = await supabase
        .from("reel_comments")
        .select(
          "id,reel_id,user_id,parent_id,content,created_at,updated_at"
        )
        .eq("reel_id", reelId)
        .order("created_at", { ascending: true });

      if (error) {
        setErrorMessage(
          `Comentariile nu au putut fi încărcate: ${error.message}`
        );

        if (showLoader) {
          setComments([]);
          setLoading(false);
        }

        return;
      }

      const commentRows = (rows ?? []) as CommentRow[];
      const userIds = [...new Set(commentRows.map((item) => item.user_id))];

      let profiles = new Map<string, Profile>();

      if (userIds.length > 0) {
        const { data: profileRows, error: profilesError } = await supabase
          .from("profiles")
          .select("id,full_name,username,avatar_url")
          .in("id", userIds);

        if (!profilesError) {
          profiles = new Map(
            ((profileRows ?? []) as Profile[]).map((profile) => [
              profile.id,
              profile,
            ])
          );
        }
      }

      const normalized = commentRows.map<ReelComment>((item) => ({
        ...item,
        profile: profiles.get(item.user_id) ?? null,
      }));

      setComments(normalized);
      onCountChangeRef.current?.(reelId, normalized.length);
      await loadEngagement(normalized.map((item) => item.id));

      if (showLoader) setLoading(false);
    },
    [loadEngagement, reelId]
  );

  useEffect(() => {
    if (!open || !reelId) return;

    setComments([]);
    setEngagement({});
    setDraft("");
    setReplyTo(null);
    setReactionPickerId(null);
    setEditingCommentId(null);
    setEditDraft("");
    setErrorMessage("");

    void loadComments(true);
  }, [loadComments, open, reelId]);

  useEffect(() => {
    if (!open || !reelId) return;

    const commentsChannel = supabase
      .channel(`reel-comments-${reelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reel_comments",
          filter: `reel_id=eq.${reelId}`,
        },
        () => void loadComments(false)
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(commentsChannel);
    };
  }, [loadComments, open, reelId]);

  useEffect(() => {
    if (!open || !reelId) return;

    const engagementChannel = supabase
      .channel(`reel-comments-engagement-${reelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reel_comment_likes",
        },
        () => {
          const ids = comments.map((item) => item.id);
          if (ids.length > 0) void loadEngagement(ids);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reel_comment_reactions",
        },
        () => {
          const ids = comments.map((item) => item.id);
          if (ids.length > 0) void loadEngagement(ids);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(engagementChannel);
    };
  }, [comments, loadEngagement, open, reelId]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;

      if (editingCommentId) {
        setEditingCommentId(null);
        setEditDraft("");
        return;
      }

      onClose();
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [editingCommentId, onClose, open]);

  const rootComments = useMemo(
    () => comments.filter((comment) => !comment.parent_id),
    [comments]
  );

  const repliesByParent = useMemo(() => {
    const map = new Map<string, ReelComment[]>();

    for (const comment of comments) {
      if (!comment.parent_id) continue;

      const group = map.get(comment.parent_id) ?? [];
      group.push(comment);
      map.set(comment.parent_id, group);
    }

    return map;
  }, [comments]);

  async function submitComment(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const content = draft.trim();
    if (!content || !currentUserId || !reelId || sending) return;

    setSending(true);
    setErrorMessage("");

    const { error } = await supabase.from("reel_comments").insert({
      reel_id: reelId,
      user_id: currentUserId,
      parent_id: replyTo?.id ?? null,
      content,
    });

    if (error) {
      setErrorMessage(`Comentariul nu a putut fi publicat: ${error.message}`);
      setSending(false);
      return;
    }

    if (replyTo && replyTo.user_id !== currentUserId) {
      const notificationResult = await createNotification({
        recipientId: replyTo.user_id,
        actorId: currentUserId,
        type: "reel_comment_reply",
        text: `a răspuns la comentariul tău: „${content.slice(0, 90)}${content.length > 90 ? "…" : ""}”`,
        reelId,
        commentId: replyTo.id,
        dedupeKey: `reply:${replyTo.id}:${content}`,
      });

      if (notificationResult.error) {
        console.warn("Notificarea de răspuns nu a putut fi creată:", notificationResult.error);
      }
    }

    setDraft("");
    setReplyTo(null);
    setSending(false);
    await loadComments(false);
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitComment();
    }
  }

  function startEditing(comment: ReelComment) {
    if (comment.user_id !== currentUserId || savingEdit) return;

    setReactionPickerId(null);
    setReplyTo(null);
    setEditingCommentId(comment.id);
    setEditDraft(comment.content);
    setErrorMessage("");
  }

  function cancelEditing() {
    if (savingEdit) return;

    setEditingCommentId(null);
    setEditDraft("");
  }

  async function saveEditedComment(comment: ReelComment) {
    const content = editDraft.trim();

    if (
      !content ||
      comment.user_id !== currentUserId ||
      editingCommentId !== comment.id ||
      savingEdit
    ) {
      return;
    }

    if (content === comment.content.trim()) {
      cancelEditing();
      return;
    }

    setSavingEdit(true);
    setErrorMessage("");

    const updatedAt = new Date().toISOString();

    setComments((current) =>
      current.map((item) =>
        item.id === comment.id
          ? {
              ...item,
              content,
              updated_at: updatedAt,
            }
          : item
      )
    );

    const { error } = await supabase
      .from("reel_comments")
      .update({
        content,
        updated_at: updatedAt,
      })
      .eq("id", comment.id)
      .eq("user_id", currentUserId);

    if (error) {
      setComments((current) =>
        current.map((item) =>
          item.id === comment.id
            ? {
                ...item,
                content: comment.content,
                updated_at: comment.updated_at,
              }
            : item
        )
      );

      setErrorMessage(
        `Comentariul nu a putut fi modificat: ${error.message}`
      );
      setSavingEdit(false);
      return;
    }

    setEditingCommentId(null);
    setEditDraft("");
    setSavingEdit(false);
    await loadComments(false);
  }

  function handleEditKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement>,
    comment: ReelComment
  ) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditing();
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void saveEditedComment(comment);
    }
  }

  async function deleteComment(comment: ReelComment) {
    if (comment.user_id !== currentUserId || busyId) return;

    setBusyId(comment.id);
    setErrorMessage("");

    const { error } = await supabase
      .from("reel_comments")
      .delete()
      .eq("id", comment.id)
      .eq("user_id", currentUserId);

    if (error) {
      setErrorMessage(`Comentariul nu a putut fi șters: ${error.message}`);
    } else {
      if (editingCommentId === comment.id) {
        setEditingCommentId(null);
        setEditDraft("");
      }

      await loadComments(false);
    }

    setBusyId(null);
  }

  async function toggleLike(commentId: string) {
    if (!currentUserId || busyId) return;

    setBusyId(commentId);
    const current = engagement[commentId] ?? emptyEngagement();

    setEngagement((state) => ({
      ...state,
      [commentId]: {
        ...current,
        likedByMe: !current.likedByMe,
        likesCount: Math.max(
          0,
          current.likesCount + (current.likedByMe ? -1 : 1)
        ),
      },
    }));

    const result = current.likedByMe
      ? await supabase
          .from("reel_comment_likes")
          .delete()
          .eq("comment_id", commentId)
          .eq("user_id", currentUserId)
      : await supabase.from("reel_comment_likes").insert({
          comment_id: commentId,
          user_id: currentUserId,
        });

    if (result.error) {
      setEngagement((state) => ({
        ...state,
        [commentId]: current,
      }));

      setErrorMessage(
        `Aprecierea nu a putut fi salvată: ${result.error.message}`
      );
    } else if (!current.likedByMe) {
      const targetComment = comments.find((item) => item.id === commentId);

      if (targetComment && targetComment.user_id !== currentUserId) {
        const notificationResult = await createNotification({
          recipientId: targetComment.user_id,
          actorId: currentUserId,
          type: "reel_comment_like",
          text: "a apreciat comentariul tău.",
          reelId: targetComment.reel_id,
          commentId,
          dedupeKey: `comment-like:${commentId}`,
        });

        if (notificationResult.error) {
          console.warn("Notificarea de apreciere nu a putut fi creată:", notificationResult.error);
        }
      }
    }

    setBusyId(null);
  }

  async function chooseReaction(
    commentId: string,
    emoji: ReactionEmoji
  ) {
    if (!currentUserId || busyId) return;

    setBusyId(commentId);
    setReactionPickerId(null);

    const current = engagement[commentId] ?? emptyEngagement();
    const existing = current.myReaction;

    if (existing === emoji) {
      const { error } = await supabase
        .from("reel_comment_reactions")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", currentUserId);

      if (error) {
        setErrorMessage(`Reacția nu a putut fi eliminată: ${error.message}`);
      }
    } else {
      const { error } = await supabase
        .from("reel_comment_reactions")
        .upsert(
          {
            comment_id: commentId,
            user_id: currentUserId,
            emoji,
          },
          { onConflict: "comment_id,user_id" }
        );

      if (error) {
        setErrorMessage(`Reacția nu a putut fi salvată: ${error.message}`);
      } else {
        const targetComment = comments.find((item) => item.id === commentId);

        if (targetComment && targetComment.user_id !== currentUserId) {
          const notificationResult = await createNotification({
            recipientId: targetComment.user_id,
            actorId: currentUserId,
            type: "reel_comment_reaction",
            text: `a reacționat ${emoji} la comentariul tău.`,
            reelId: targetComment.reel_id,
            commentId,
            reaction: emoji,
            dedupeKey: `comment-reaction:${commentId}`,
          });

          if (notificationResult.error) {
            console.warn("Notificarea de reacție nu a putut fi creată:", notificationResult.error);
          }
        }
      }
    }

    await loadEngagement(comments.map((item) => item.id));
    setBusyId(null);
  }

  function renderComment(comment: ReelComment, isReply = false) {
    const item = engagement[comment.id] ?? emptyEngagement();
    const isEditing = editingCommentId === comment.id;
    const reactionEntries = REACTIONS.filter(
      (emoji) => (item.reactions[emoji] ?? 0) > 0
    );

    return (
      <motion.article
        key={comment.id}
        className={`${styles.comment} ${
          isReply ? styles.replyComment : ""
        }`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
      >
        <div className={styles.avatar}>
          {comment.profile?.avatar_url ? (
            <img src={comment.profile.avatar_url} alt="" />
          ) : (
            initials(comment.profile)
          )}
        </div>

        <div className={styles.commentBody}>
          <div className={styles.commentBubble}>
            <div className={styles.commentHeader}>
              <strong>{displayName(comment.profile)}</strong>

              <span>
                {formatDate(comment.updated_at ?? comment.created_at)}
                {wasEdited(comment) ? " · editat" : ""}
              </span>
            </div>

            {isEditing ? (
              <div
                style={{
                  display: "grid",
                  gap: 10,
                  marginTop: 8,
                }}
              >
                <textarea
                  autoFocus
                  value={editDraft}
                  onChange={(event) => setEditDraft(event.target.value)}
                  onKeyDown={(event) => handleEditKeyDown(event, comment)}
                  maxLength={1000}
                  rows={3}
                  aria-label="Editează comentariul"
                  style={{
                    width: "100%",
                    resize: "vertical",
                    minHeight: 82,
                    borderRadius: 14,
                    border: "1px solid rgba(110, 231, 183, 0.28)",
                    background: "rgba(2, 6, 23, 0.45)",
                    color: "white",
                    padding: "11px 12px",
                    outline: "none",
                    font: "inherit",
                    lineHeight: 1.5,
                  }}
                />

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => void saveEditedComment(comment)}
                    disabled={savingEdit || !editDraft.trim()}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      borderRadius: 12,
                      border: "1px solid rgba(110, 231, 183, 0.25)",
                      background: "rgba(16, 185, 129, 0.16)",
                      color: "rgb(209, 250, 229)",
                      padding: "7px 11px",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    {savingEdit ? (
                      <LoaderCircle size={14} className={styles.spin} />
                    ) : (
                      <Check size={14} />
                    )}
                    Salvează
                  </button>

                  <button
                    type="button"
                    onClick={cancelEditing}
                    disabled={savingEdit}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      borderRadius: 12,
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      background: "rgba(255, 255, 255, 0.05)",
                      color: "rgba(255, 255, 255, 0.72)",
                      padding: "7px 11px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <X size={14} />
                    Anulează
                  </button>

                  <small
                    style={{
                      color: "rgba(255, 255, 255, 0.4)",
                    }}
                  >
                    Enter salvează · Shift + Enter adaugă un rând
                  </small>
                </div>
              </div>
            ) : (
              <p>{comment.content}</p>
            )}
          </div>

          {!isEditing && reactionEntries.length > 0 && (
            <div className={styles.reactionSummary}>
              {reactionEntries.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={item.myReaction === emoji ? styles.myReaction : ""}
                  onClick={() => void chooseReaction(comment.id, emoji)}
                >
                  <span>{emoji}</span>
                  <small>{item.reactions[emoji]}</small>
                </button>
              ))}
            </div>
          )}

          {!isEditing && (
            <div className={styles.commentActions}>
              <motion.button
                type="button"
                className={item.likedByMe ? styles.liked : ""}
                onClick={() => void toggleLike(comment.id)}
                whileTap={{ scale: 1.25 }}
              >
                <Heart
                  size={14}
                  fill={item.likedByMe ? "currentColor" : "none"}
                />
                {item.likesCount > 0 ? item.likesCount : "Apreciază"}
              </motion.button>

              <div className={styles.reactionWrap}>
                <button
                  type="button"
                  className={item.myReaction ? styles.reacted : ""}
                  onClick={() =>
                    setReactionPickerId((current) =>
                      current === comment.id ? null : comment.id
                    )
                  }
                >
                  <SmilePlus size={14} />
                  Reacție
                </button>

                <AnimatePresence>
                  {reactionPickerId === comment.id && (
                    <motion.div
                      className={styles.reactionPicker}
                      initial={{ opacity: 0, y: 8, scale: 0.92 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.92 }}
                    >
                      {REACTIONS.map((emoji) => (
                        <motion.button
                          key={emoji}
                          type="button"
                          onClick={() => void chooseReaction(comment.id, emoji)}
                          whileHover={{ y: -5, scale: 1.22 }}
                          whileTap={{ scale: 0.86 }}
                          title={`Reacție ${emoji}`}
                        >
                          {emoji}
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {!isReply && (
                <button type="button" onClick={() => setReplyTo(comment)}>
                  <Reply size={14} />
                  Răspunde
                </button>
              )}

              {comment.user_id === currentUserId && (
                <>
                  <button
                    type="button"
                    onClick={() => startEditing(comment)}
                    disabled={savingEdit}
                  >
                    <Pencil size={14} />
                    Editează
                  </button>

                  <button
                    type="button"
                    onClick={() => void deleteComment(comment)}
                    disabled={busyId === comment.id}
                  >
                    {busyId === comment.id ? (
                      <LoaderCircle size={14} className={styles.spin} />
                    ) : (
                      <Trash2 size={14} />
                    )}
                    Șterge
                  </button>
                </>
              )}
            </div>
          )}

          {!isReply && (repliesByParent.get(comment.id) ?? []).length > 0 && (
            <div className={styles.replies}>
              {(repliesByParent.get(comment.id) ?? []).map((reply) =>
                renderComment(reply, true)
              )}
            </div>
          )}
        </div>
      </motion.article>
    );
  }

  return (
    <AnimatePresence>
      {open && reelId && (
        <motion.div
          className={styles.backdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.aside
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-label="Comentarii Reel"
            initial={{ opacity: 0, x: 45 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 45 }}
            transition={{ duration: 0.22 }}
          >
            <header className={styles.header}>
              <div>
                <span>REELS • FRIENDS</span>
                <h2>Comentarii</h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Închide comentariile"
              >
                <X />
              </button>
            </header>

            <div className={styles.countRow}>
              <MessageCircle size={17} />
              <span>
                {comments.length}{" "}
                {comments.length === 1 ? "comentariu" : "comentarii"}
              </span>
            </div>

            <div className={styles.list}>
              {loading ? (
                <div className={styles.state}>
                  <LoaderCircle className={styles.spin} />
                  <span>Se încarcă...</span>
                </div>
              ) : rootComments.length === 0 ? (
                <div className={styles.empty}>
                  <MessageCircle />
                  <strong>Fii primul care comentează</strong>
                  <p>Scrie ceva prietenos despre acest Reel.</p>
                </div>
              ) : (
                rootComments.map((comment) => renderComment(comment))
              )}
            </div>

            {errorMessage && <p className={styles.error}>{errorMessage}</p>}

            <form className={styles.composer} onSubmit={submitComment}>
              {replyTo && (
                <div className={styles.replying}>
                  <span>Răspunzi lui {displayName(replyTo.profile)}</span>
                  <button type="button" onClick={() => setReplyTo(null)}>
                    Anulează
                  </button>
                </div>
              )}

              <div className={styles.composerRow}>
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder={
                    replyTo ? "Scrie răspunsul..." : "Scrie un comentariu..."
                  }
                  maxLength={1000}
                  rows={1}
                />

                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  aria-label="Trimite comentariul"
                >
                  {sending ? (
                    <LoaderCircle className={styles.spin} />
                  ) : (
                    <Send />
                  )}
                </button>
              </div>

              <small>Enter trimite • Shift + Enter adaugă un rând nou</small>
            </form>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
