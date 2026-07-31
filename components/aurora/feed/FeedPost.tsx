"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { REACTIONS } from "./feed-types";
import type {
  Comment,
  Post,
  Reaction,
  ReactionValue,
} from "./feed-types";
import {
  formatRelativeDate,
  getDisplayName,
  getInitials,
} from "./feed-utils";

type FeedPostProps = {
  post: Post;
  reactions: Reaction[];
  comments: Comment[];
  currentUserId: string;
  imageUrls: Record<string, string>;
  busyPostId: number | null;
  openReactionPostId: number | null;
  openCommentsPostId: number | null;
  commentDraft: string;
  editingPostId: number | null;
  editingText: string;
  onOpenReactionChange: (postId: number | null) => void;
  onOpenCommentsChange: (postId: number | null) => void;
  onCommentDraftChange: (postId: number, value: string) => void;
  onEditingTextChange: (value: string) => void;
  onCancelEditing: () => void;
  onBeginEditing: (post: Post) => void;
  onSaveEdit: (post: Post) => Promise<void>;
  onDeletePost: (post: Post) => Promise<void>;
  onSharePost: (post: Post) => Promise<void>;
  onToggleReaction: (
    postId: number,
    reaction: ReactionValue
  ) => Promise<void>;
  onDeleteComment: (comment: Comment) => Promise<void>;
  onAddComment: (
    event: FormEvent<HTMLFormElement>,
    postId: number
  ) => Promise<void>;
};

export default function FeedPost({
  post,
  reactions,
  comments,
  currentUserId,
  imageUrls,
  busyPostId,
  openReactionPostId,
  openCommentsPostId,
  commentDraft,
  editingPostId,
  editingText,
  onOpenReactionChange,
  onOpenCommentsChange,
  onCommentDraftChange,
  onEditingTextChange,
  onCancelEditing,
  onBeginEditing,
  onSaveEdit,
  onDeletePost,
  onSharePost,
  onToggleReaction,
  onDeleteComment,
  onAddComment,
}: FeedPostProps) {
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [viewerPostId, setViewerPostId] = useState<number | null>(null);
  const [viewerCommentsOpen, setViewerCommentsOpen] = useState(false);
  const [viewerInfoOpen, setViewerInfoOpen] = useState(false);
  const [viewerZoom, setViewerZoom] = useState(1);
  const [viewerOffset, setViewerOffset] = useState({ x: 0, y: 0 });
  const [viewerHeartVisible, setViewerHeartVisible] = useState(false);
  const [viewerMessage, setViewerMessage] = useState("");
  const dragState = useRef({
    active: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });

  function openViewer(imageUrl: string, reactionPostId: number) {
    setViewerImage(imageUrl);
    setViewerPostId(reactionPostId);
    setViewerCommentsOpen(false);
    setViewerInfoOpen(false);
    setViewerZoom(1);
    setViewerOffset({ x: 0, y: 0 });
    setViewerMessage("");
  }

  function closeViewer() {
    setViewerImage(null);
    setViewerPostId(null);
    setViewerCommentsOpen(false);
    setViewerInfoOpen(false);
    setViewerZoom(1);
    setViewerOffset({ x: 0, y: 0 });
    setViewerHeartVisible(false);
    setViewerMessage("");
  }

  function changeViewerZoom(nextZoom: number) {
    const safeZoom = Math.min(4, Math.max(1, nextZoom));
    setViewerZoom(safeZoom);

    if (safeZoom === 1) {
      setViewerOffset({ x: 0, y: 0 });
    }
  }

  function showViewerMessage(message: string) {
    setViewerMessage(message);
    window.setTimeout(() => setViewerMessage(""), 1800);
  }

  async function shareViewerImage() {
    if (!viewerImage) return;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Fotografie de la ${getDisplayName(post.profiles)}`,
          text: post.content || "Fotografie distribuită în Friends",
          url: viewerImage,
        });
        return;
      }

      await navigator.clipboard.writeText(viewerImage);
      showViewerMessage("Linkul fotografiei a fost copiat.");
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        showViewerMessage("Distribuirea nu a putut fi pornită.");
      }
    }
  }

  useEffect(() => {
    if (!viewerImage) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeViewer();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [viewerImage]);

  const postReactions = reactions.filter(
    (reaction) => reaction.post_id === post.id
  );
  const postComments = comments.filter(
    (comment) => comment.post_id === post.id
  );
  const myReaction = postReactions.find(
    (reaction) => reaction.user_id === currentUserId
  );
  const reactionCounts = REACTIONS.map((reaction) => ({
    reaction,
    count: postReactions.filter((item) => item.reaction === reaction).length,
  })).filter((item) => item.count > 0);

  const mainImageUrl =
    post.image_path && imageUrls[post.image_path]
      ? imageUrls[post.image_path]
      : null;

  const sharedImageUrl =
    post.shared_post?.image_path && imageUrls[post.shared_post.image_path]
      ? imageUrls[post.shared_post.image_path]
      : null;

  const totalReactionCount = postReactions.length;

  return (
    <>
      <article className="aurora-post-card aurora-v2-post-card">
        <div className="aurora-v2-card-shine" aria-hidden="true" />

        <header className="aurora-post-header aurora-v2-post-header">
          <div className="flex items-center gap-3">
            <div className="aurora-post-avatar aurora-v2-avatar">
              {post.profiles?.avatar_url ? (
                <img
                  src={post.profiles.avatar_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                getInitials(post.profiles)
              )}
            </div>

            <div>
              <p className="aurora-post-author">
                {getDisplayName(post.profiles)}
              </p>
              <p className="aurora-post-time">
                {formatRelativeDate(post.created_at)}
                {post.updated_at ? " · editat" : ""}
              </p>
            </div>
          </div>

          {post.user_id === currentUserId && (
            <div className="aurora-post-owner-actions aurora-v2-owner-actions">
              <button
                type="button"
                onClick={() => onBeginEditing(post)}
                className="aurora-text-button aurora-text-button-edit"
              >
                Editează
              </button>
              <button
                type="button"
                onClick={() => void onDeletePost(post)}
                disabled={busyPostId === post.id}
                className="aurora-text-button aurora-text-button-delete"
              >
                Șterge
              </button>
            </div>
          )}
        </header>

        {editingPostId === post.id ? (
          <div className="aurora-comments aurora-v2-edit-zone">
            <textarea
              value={editingText}
              onChange={(event) => onEditingTextChange(event.target.value)}
              className="aurora-edit-textarea"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancelEditing}
                className="aurora-secondary-button"
              >
                Renunță
              </button>
              <button
                type="button"
                onClick={() => void onSaveEdit(post)}
                disabled={busyPostId === post.id}
                className="aurora-primary-button"
              >
                Salvează
              </button>
            </div>
          </div>
        ) : (
          post.content && (
            <p className="aurora-post-content aurora-v2-post-content">
              {post.content}
            </p>
          )
        )}

        {mainImageUrl && (
          <button
            type="button"
            className="aurora-v2-media-button"
            onClick={() => openViewer(mainImageUrl, post.id)}
            aria-label="Deschide fotografia pe tot ecranul"
          >
            <img
              src={mainImageUrl}
              alt="Fotografie din postare"
              className="aurora-post-image aurora-v2-post-image"
              loading="lazy"
            />
            <span className="aurora-v2-media-hint">⛶ Vezi fotografia</span>
          </button>
        )}

        {post.shared_post && (
          <div className="aurora-shared-post aurora-v2-shared-post">
            <div className="aurora-v2-shared-label">Postare distribuită</div>
            <p className="aurora-post-author">
              {getDisplayName(post.shared_post.profiles)}
            </p>
            <p className="aurora-post-time">
              {formatRelativeDate(post.shared_post.created_at)}
            </p>

            {post.shared_post.content && (
              <p className="mt-3 whitespace-pre-wrap break-words text-gray-800">
                {post.shared_post.content}
              </p>
            )}

            {sharedImageUrl && (
              <button
                type="button"
                className="aurora-v2-media-button aurora-v2-shared-media"
                onClick={() => openViewer(sharedImageUrl, post.id)}
                aria-label="Deschide fotografia distribuită pe tot ecranul"
              >
                <img
                  src={sharedImageUrl}
                  alt="Fotografie distribuită"
                  className="aurora-v2-post-image"
                  loading="lazy"
                />
                <span className="aurora-v2-media-hint">⛶ Vezi fotografia</span>
              </button>
            )}
          </div>
        )}

        {(reactionCounts.length > 0 || postComments.length > 0) && (
          <div className="aurora-post-meta aurora-v2-post-meta">
            <div className="aurora-v2-reaction-summary">
              {reactionCounts.map((item) => (
                <span key={item.reaction}>
                  {item.reaction} {item.count}
                </span>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                onOpenCommentsChange(
                  openCommentsPostId === post.id ? null : post.id
                )
              }
              className="aurora-v2-comment-count"
            >
              {postComments.length}{" "}
              {postComments.length === 1 ? "comentariu" : "comentarii"}
            </button>
          </div>
        )}

        <div className="aurora-v2-reaction-strip" aria-label="Alege reacția">
          {REACTIONS.map((reaction) => {
            const active = myReaction?.reaction === reaction;

            return (
              <button
                key={reaction}
                type="button"
                onClick={() => void onToggleReaction(post.id, reaction)}
                disabled={busyPostId === post.id}
                className={`aurora-v2-reaction-chip ${
                  active ? "aurora-v2-reaction-chip-active" : ""
                }`}
                title={`Reacționează cu ${reaction}`}
              >
                <span>{reaction}</span>
              </button>
            );
          })}
        </div>

        <div className="aurora-post-actions aurora-v2-post-actions">
          <button
            type="button"
            onClick={() =>
              onOpenReactionChange(
                openReactionPostId === post.id ? null : post.id
              )
            }
            className={`aurora-post-action aurora-v2-action ${
              myReaction ? "aurora-post-action-active" : ""
            }`}
          >
            <span className="aurora-v2-action-icon">
              {myReaction?.reaction ?? "✦"}
            </span>
            {myReaction ? "Reacția ta" : "Reacționează"}
          </button>

          <button
            type="button"
            onClick={() =>
              onOpenCommentsChange(
                openCommentsPostId === post.id ? null : post.id
              )
            }
            className="aurora-post-action aurora-v2-action"
          >
            <span className="aurora-v2-action-icon">💬</span>
            Comentează
          </button>

          <button
            type="button"
            onClick={() => void onSharePost(post)}
            disabled={busyPostId === post.id}
            className="aurora-post-action aurora-v2-action disabled:opacity-50"
          >
            <span className="aurora-v2-action-icon">↗</span>
            Distribuie
          </button>

          {openReactionPostId === post.id && (
            <div className="aurora-reaction-picker aurora-v2-floating-picker">
              {REACTIONS.map((reaction) => (
                <button
                  key={reaction}
                  type="button"
                  onClick={() => void onToggleReaction(post.id, reaction)}
                  disabled={busyPostId === post.id}
                  className="aurora-reaction-option"
                  title={reaction}
                >
                  {reaction}
                </button>
              ))}
            </div>
          )}
        </div>

        {openCommentsPostId === post.id && (
          <div className="aurora-comments aurora-v2-comments">
            <div className="aurora-comment-list">
              {postComments.length === 0 && (
                <p className="aurora-v2-empty-comments">
                  Fii primul care lasă un comentariu.
                </p>
              )}

              {postComments.map((comment) => (
                <div key={comment.id} className="aurora-comment-row">
                  <div className="aurora-comment-avatar aurora-v2-comment-avatar">
                    {comment.profiles?.avatar_url ? (
                      <img
                        src={comment.profiles.avatar_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      getInitials(comment.profiles)
                    )}
                  </div>

                  <div className="aurora-comment-bubble aurora-v2-comment-bubble">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {getDisplayName(comment.profiles)}
                        </p>
                        <p className="whitespace-pre-wrap break-words text-sm text-gray-800">
                          {comment.content}
                        </p>
                      </div>

                      {comment.user_id === currentUserId && (
                        <button
                          type="button"
                          onClick={() => void onDeleteComment(comment)}
                          className="aurora-v2-delete-comment"
                        >
                          Șterge
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={(event) => void onAddComment(event, post.id)}
              className="aurora-comment-form aurora-v2-comment-form"
            >
              <input
                value={commentDraft}
                onChange={(event) =>
                  onCommentDraftChange(post.id, event.target.value)
                }
                maxLength={2000}
                placeholder="Scrie un comentariu..."
                className="aurora-comment-input aurora-v2-comment-input"
              />
              <button
                type="submit"
                disabled={
                  busyPostId === post.id || !commentDraft.trim()
                }
                className="aurora-comment-submit aurora-v2-comment-submit"
              >
                Trimite
              </button>
            </form>
          </div>
        )}
      </article>

      {viewerImage && viewerPostId !== null && (
        <div
          className={`aurora-v2-viewer ${
            viewerCommentsOpen ? "aurora-v2-viewer-with-comments" : ""
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="Vizualizare fotografie"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeViewer();
            }
          }}
        >
          <button
            type="button"
            className="aurora-v2-viewer-close"
            onClick={closeViewer}
            aria-label="Închide fotografia"
          >
            ×
          </button>

          <div className="aurora-v2-viewer-layout">
            <div className="aurora-v2-viewer-stage">
              <div
                className={`aurora-v3-image-canvas ${
                  viewerZoom > 1 ? "aurora-v3-image-canvas-zoomed" : ""
                }`}
                onWheel={(event) => {
                  event.preventDefault();
                  const step = event.deltaY < 0 ? 0.2 : -0.2;
                  changeViewerZoom(viewerZoom + step);
                }}
                onPointerDown={(event) => {
                  if (viewerZoom <= 1) return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  dragState.current = {
                    active: true,
                    startX: event.clientX,
                    startY: event.clientY,
                    originX: viewerOffset.x,
                    originY: viewerOffset.y,
                  };
                }}
                onPointerMove={(event) => {
                  if (!dragState.current.active || viewerZoom <= 1) return;

                  setViewerOffset({
                    x:
                      dragState.current.originX +
                      event.clientX -
                      dragState.current.startX,
                    y:
                      dragState.current.originY +
                      event.clientY -
                      dragState.current.startY,
                  });
                }}
                onPointerUp={(event) => {
                  dragState.current.active = false;
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }
                }}
                onPointerCancel={() => {
                  dragState.current.active = false;
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  setViewerHeartVisible(true);
                  window.setTimeout(
                    () => setViewerHeartVisible(false),
                    850
                  );

                  if (viewerPostId !== null) {
                    void onToggleReaction(viewerPostId, "❤️");
                  }
                }}
              >
                <img
                  src={viewerImage}
                  alt="Fotografie mărită"
                  className="aurora-v2-viewer-image aurora-v3-transformable-image"
                  draggable={false}
                  style={{
                    transform: `translate3d(${viewerOffset.x}px, ${viewerOffset.y}px, 0) scale(${viewerZoom})`,
                  }}
                />

                {viewerHeartVisible && (
                  <div className="aurora-v3-double-like" aria-hidden="true">
                    ❤️
                  </div>
                )}
              </div>

              <div
                className="aurora-v3-viewer-toolbar"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => changeViewerZoom(viewerZoom - 0.25)}
                  disabled={viewerZoom <= 1}
                  title="Micșorează"
                >
                  −
                </button>
                <span>{Math.round(viewerZoom * 100)}%</span>
                <button
                  type="button"
                  onClick={() => changeViewerZoom(viewerZoom + 0.25)}
                  disabled={viewerZoom >= 4}
                  title="Mărește"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => changeViewerZoom(1)}
                  title="Resetează fotografia"
                >
                  Reset
                </button>
                <a
                  href={viewerImage}
                  download
                  target="_blank"
                  rel="noreferrer"
                  title="Salvează fotografia"
                >
                  ↓ Salvează
                </a>
                <button
                  type="button"
                  onClick={() => void shareViewerImage()}
                  title="Distribuie fotografia"
                >
                  ↗ Distribuie
                </button>
                <button
                  type="button"
                  onClick={() => setViewerInfoOpen((current) => !current)}
                  className={
                    viewerInfoOpen ? "aurora-v3-toolbar-active" : ""
                  }
                  title="Informații despre postare"
                >
                  ⓘ Info
                </button>
              </div>

              {viewerInfoOpen && (
                <div
                  className="aurora-v3-viewer-info"
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <div className="aurora-v3-info-avatar">
                    {post.profiles?.avatar_url ? (
                      <img
                        src={post.profiles.avatar_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      getInitials(post.profiles)
                    )}
                  </div>
                  <div>
                    <p className="aurora-v3-info-author">
                      {getDisplayName(post.profiles)}
                    </p>
                    <p className="aurora-v3-info-date">
                      {formatRelativeDate(post.created_at)}
                    </p>
                    {post.content && (
                      <p className="aurora-v3-info-content">
                        {post.content}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {viewerMessage && (
                <div className="aurora-v3-viewer-message">
                  {viewerMessage}
                </div>
              )}

              <div
                className="aurora-v2-viewer-reactions"
                aria-label="Reacții la fotografie"
              >
                <div className="aurora-v2-viewer-reaction-info">
                  <span className="aurora-v2-viewer-current-reaction">
                    {myReaction?.reaction ?? "✦"}
                  </span>
                  <span>
                    {totalReactionCount}{" "}
                    {totalReactionCount === 1 ? "reacție" : "reacții"}
                  </span>
                </div>

                <div className="aurora-v2-viewer-reaction-buttons">
                  {REACTIONS.map((reaction) => {
                    const active = myReaction?.reaction === reaction;

                    return (
                      <button
                        key={reaction}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void onToggleReaction(viewerPostId, reaction);
                        }}
                        disabled={busyPostId === viewerPostId}
                        className={`aurora-v2-viewer-reaction-button ${
                          active
                            ? "aurora-v2-viewer-reaction-button-active"
                            : ""
                        }`}
                        title={`Reacționează cu ${reaction}`}
                        aria-pressed={active}
                      >
                        {reaction}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  className={`aurora-v2-viewer-comments-button ${
                    viewerCommentsOpen
                      ? "aurora-v2-viewer-comments-button-active"
                      : ""
                  }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setViewerCommentsOpen((current) => !current);
                  }}
                  aria-expanded={viewerCommentsOpen}
                >
                  💬 {postComments.length}
                </button>
              </div>
            </div>

            {viewerCommentsOpen && (
              <aside
                className="aurora-v2-viewer-comments-panel"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <header className="aurora-v2-viewer-comments-header">
                  <div>
                    <p className="aurora-v2-viewer-comments-title">
                      Comentarii
                    </p>
                    <p className="aurora-v2-viewer-comments-subtitle">
                      {postComments.length}{" "}
                      {postComments.length === 1
                        ? "comentariu"
                        : "comentarii"}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="aurora-v2-viewer-panel-close"
                    onClick={() => setViewerCommentsOpen(false)}
                    aria-label="Închide comentariile"
                  >
                    ×
                  </button>
                </header>

                <div className="aurora-v2-viewer-comment-list">
                  {postComments.length === 0 && (
                    <p className="aurora-v2-viewer-empty-comments">
                      Fii primul care lasă un comentariu.
                    </p>
                  )}

                  {postComments.map((comment) => (
                    <div
                      key={comment.id}
                      className="aurora-v2-viewer-comment-row"
                    >
                      <div className="aurora-comment-avatar aurora-v2-comment-avatar">
                        {comment.profiles?.avatar_url ? (
                          <img
                            src={comment.profiles.avatar_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          getInitials(comment.profiles)
                        )}
                      </div>

                      <div className="aurora-v2-viewer-comment-bubble">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {getDisplayName(comment.profiles)}
                            </p>
                            <p className="whitespace-pre-wrap break-words text-sm text-slate-700">
                              {comment.content}
                            </p>
                          </div>

                          {comment.user_id === currentUserId && (
                            <button
                              type="button"
                              onClick={() =>
                                void onDeleteComment(comment)
                              }
                              className="aurora-v2-delete-comment"
                            >
                              Șterge
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <form
                  onSubmit={(event) =>
                    void onAddComment(event, viewerPostId)
                  }
                  className="aurora-v2-viewer-comment-form"
                >
                  <input
                    value={commentDraft}
                    onChange={(event) =>
                      onCommentDraftChange(
                        viewerPostId,
                        event.target.value
                      )
                    }
                    maxLength={2000}
                    placeholder="Scrie un comentariu..."
                    className="aurora-v2-viewer-comment-input"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={
                      busyPostId === viewerPostId ||
                      !commentDraft.trim()
                    }
                    className="aurora-v2-viewer-comment-submit"
                  >
                    Trimite
                  </button>
                </form>
              </aside>
            )}
          </div>

          <p className="aurora-v2-viewer-help">
            Rotița mouse-ului pentru zoom · trage fotografia · dublu-click pentru ❤️
          </p>
        </div>
      )}
    </>
  );
}
