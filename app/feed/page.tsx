"use client";

import Link from "next/link";
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AuroraComposer from "@/components/aurora/AuroraComposer";
import StoryBar from "@/components/aurora/StoryBar";
import FeedReelsStrip from "@/components/aurora/feed/FeedReelsStrip";
import FriendsLocationMap from "@/components/feed/FriendsLocationMap";
import OnlineFriendsCard from "@/components/feed/OnlineFriendsCard";
import FeedLayout from "@/components/feed/FeedLayout";
import "@/styles/aurora-feed.css";
import "@/styles/feed-reels-strip.css";
import "@/styles/friends-location-map.css";
import "@/styles/friends-location-fullscreen-audit-fix.css";
import "@/styles/friends-map-marker-position-fix.css";
import "@/styles/friends-global-theme-glass.css";
import "@/styles/feed-single-side-cards.css";
import "@/styles/friends-map-blue-exact-location.css";
import { supabase } from "@/lib/supabase";

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "😡"] as const;
type ReactionValue = (typeof REACTIONS)[number];

type Profile = {
  id?: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type Post = {
  id: number;
  content: string;
  user_id: string;
  image_path: string | null;
  shared_post_id: number | null;
  created_at: string;
  updated_at: string | null;
  profiles: Profile | null;
  shared_post: {
    id: number;
    content: string;
    user_id: string;
    image_path: string | null;
    created_at: string;
    profiles: Profile | null;
  } | null;
};

type Reaction = {
  id: number;
  post_id: number;
  user_id: string;
  reaction: ReactionValue;
};

type Comment = {
  id: number;
  post_id: number;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string | null;
  profiles: Profile | null;
};

function normalizeProfile(value: unknown): Profile | null {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as Profile | undefined) ?? null;
  return value as Profile;
}

function getDisplayName(profile: Profile | null) {
  return profile?.full_name || profile?.username || "Utilizator";
}

function getInitials(profile: Profile | null) {
  return getDisplayName(profile)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function formatRelativeDate(value: string) {
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

export default function FeedPage() {
  const [currentUserId, setCurrentUserId] = useState("");
  const [postText, setPostText] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [busyPostId, setBusyPostId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [openReactionPostId, setOpenReactionPostId] = useState<number | null>(null);
  const [openCommentsPostId, setOpenCommentsPostId] = useState<number | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrl = useMemo(
    () => (selectedImage ? URL.createObjectURL(selectedImage) : null),
    [selectedImage]
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const loadFeed = useCallback(async () => {
    setLoadingPosts(true);
    setErrorMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setErrorMessage("Nu ești autentificat.");
      setLoadingPosts(false);
      return;
    }

    setCurrentUserId(user.id);

    const postsResult = await supabase
      .from("posts")
      .select(`
        id,
        content,
        user_id,
        image_path,
        shared_post_id,
        created_at,
        updated_at
      `)
      .order("created_at", { ascending: false });

    if (postsResult.error) {
      setErrorMessage(`Postările nu au putut fi încărcate: ${postsResult.error.message}`);
      setLoadingPosts(false);
      return;
    }

    const basePosts = (postsResult.data ?? []).map((row: any) => ({
      ...row,
      profiles: null,
      shared_post: null,
    })) as Post[];

    const postIds = basePosts.map((post) => post.id);
    const sharedPostIds = [
      ...new Set(
        basePosts
          .map((post) => post.shared_post_id)
          .filter((id): id is number => typeof id === "number")
      ),
    ];

    let rawSharedPosts: any[] = [];

    if (sharedPostIds.length > 0) {
      const sharedPostsResult = await supabase
        .from("posts")
        .select(`
          id,
          content,
          user_id,
          image_path,
          created_at
        `)
        .in("id", sharedPostIds);

      if (sharedPostsResult.error) {
        setErrorMessage(
          `Postările distribuite nu au putut fi încărcate: ${sharedPostsResult.error.message}`
        );
      } else {
        rawSharedPosts = sharedPostsResult.data ?? [];
      }
    }

    let rawReactions: Reaction[] = [];
    let rawComments: any[] = [];

    if (postIds.length > 0) {
      const [reactionResult, commentResult] = await Promise.all([
        supabase
          .from("post_reactions")
          .select("id, post_id, user_id, reaction")
          .in("post_id", postIds),
        supabase
          .from("post_comments")
          .select(`
            id,
            post_id,
            user_id,
            content,
            created_at,
            updated_at
          `)
          .in("post_id", postIds)
          .order("created_at", { ascending: true }),
      ]);

      if (reactionResult.error) {
        setErrorMessage(`Reacțiile nu au putut fi încărcate: ${reactionResult.error.message}`);
      } else {
        rawReactions = (reactionResult.data ?? []) as Reaction[];
      }

      if (commentResult.error) {
        setErrorMessage(`Comentariile nu au putut fi încărcate: ${commentResult.error.message}`);
      } else {
        rawComments = commentResult.data ?? [];
      }
    }

    const profileUserIds = [
      ...new Set([
        ...basePosts.map((post) => post.user_id),
        ...rawSharedPosts.map((post) => post.user_id),
        ...rawComments.map((comment) => comment.user_id),
      ]),
    ].filter(Boolean);

    const profilesById = new Map<string, Profile>();

    if (profileUserIds.length > 0) {
      const profilesResult = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .in("id", profileUserIds);

      if (profilesResult.error) {
        setErrorMessage(
          `Profilurile nu au putut fi încărcate: ${profilesResult.error.message}`
        );
      } else {
        for (const profile of profilesResult.data ?? []) {
          profilesById.set(profile.id, profile as Profile);
        }
      }
    }

    const sharedPostsById = new Map<number, Post["shared_post"]>(
      rawSharedPosts.map((row: any) => [
        row.id,
        {
          ...row,
          profiles: profilesById.get(row.user_id) ?? null,
        },
      ])
    );

    const normalizedPosts = basePosts.map((post) => ({
      ...post,
      profiles: profilesById.get(post.user_id) ?? null,
      shared_post:
        post.shared_post_id !== null
          ? sharedPostsById.get(post.shared_post_id) ?? null
          : null,
    }));

    const normalizedComments = rawComments.map((row: any) => ({
      ...row,
      profiles: profilesById.get(row.user_id) ?? null,
    })) as Comment[];

    setPosts(normalizedPosts);
    setReactions(rawReactions);
    setComments(normalizedComments);
    setLoadingPosts(false);
  }, []);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    const channel = supabase
      .channel("feed-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        () => void loadFeed()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_reactions" },
        () => void loadFeed()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_comments" },
        () => void loadFeed()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadFeed]);

  useEffect(() => {
    const paths = new Set<string>();

    for (const post of posts) {
      if (post.image_path) paths.add(post.image_path);
      if (post.shared_post?.image_path) paths.add(post.shared_post.image_path);
    }

    const missingPaths = [...paths].filter((path) => !imageUrls[path]);
    if (missingPaths.length === 0) return;

    let cancelled = false;

    async function createUrls() {
      const entries = await Promise.all(
        missingPaths.map(async (path) => {
          const { data, error } = await supabase.storage
            .from("post-images")
            .createSignedUrl(path, 60 * 60);

          return !error && data?.signedUrl ? ([path, data.signedUrl] as const) : null;
        })
      );

      if (cancelled) return;

      setImageUrls((current) => {
        const next = { ...current };
        for (const entry of entries) {
          if (entry) next[entry[0]] = entry[1];
        }
        return next;
      });
    }

    void createUrls();

    return () => {
      cancelled = true;
    };
  }, [posts, imageUrls]);

  function selectImageFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Poți selecta doar o imagine.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("Imaginea este prea mare. Limita este de 10 MB.");
      return;
    }

    setErrorMessage("");
    setSelectedImage(file);
  }

  function handleImageSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Poți selecta doar o imagine.");
      event.currentTarget.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("Imaginea este prea mare. Limita este de 10 MB.");
      event.currentTarget.value = "";
      return;
    }

    selectImageFile(file);
  }

  async function handlePublish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = postText.trim();
    if ((!content && !selectedImage) || !currentUserId || publishing) return;

    setPublishing(true);
    setErrorMessage("");

    let uploadedPath: string | null = null;

    try {
      if (selectedImage) {
        const extension =
          selectedImage.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ||
          "jpg";

        uploadedPath = `${currentUserId}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("post-images")
          .upload(uploadedPath, selectedImage, {
            contentType: selectedImage.type,
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          setErrorMessage(`Imaginea nu a putut fi încărcată: ${uploadError.message}`);
          return;
        }
      }

      const { error } = await supabase.from("posts").insert({
        content,
        user_id: currentUserId,
        image_path: uploadedPath,
      });

      if (error) {
        if (uploadedPath) {
          await supabase.storage.from("post-images").remove([uploadedPath]);
        }

        setErrorMessage(`Postarea nu a putut fi publicată: ${error.message}`);
        return;
      }

      setPostText("");
      setSelectedImage(null);

      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }

      await loadFeed();
    } finally {
      setPublishing(false);
    }
  }

  async function toggleReaction(postId: number, reaction: ReactionValue) {
    if (!currentUserId || busyPostId !== null) return;

    setBusyPostId(postId);
    setOpenReactionPostId(null);
    setErrorMessage("");

    const existing = reactions.find(
      (item) => item.post_id === postId && item.user_id === currentUserId
    );

    if (existing?.reaction === reaction) {
      const { error } = await supabase
        .from("post_reactions")
        .delete()
        .eq("id", existing.id)
        .eq("user_id", currentUserId);

      if (error) setErrorMessage(`Reacția nu a putut fi eliminată: ${error.message}`);
    } else {
      const { error } = await supabase.from("post_reactions").upsert(
        {
          post_id: postId,
          user_id: currentUserId,
          reaction,
        },
        { onConflict: "post_id,user_id" }
      );

      if (error) {
  console.error(error);
  alert(error.message);
  setErrorMessage(`Reacția nu a putut fi salvată: ${error.message}`);
}
    }

    setBusyPostId(null);
    await loadFeed();
  }

  async function addComment(event: FormEvent<HTMLFormElement>, postId: number) {
    event.preventDefault();

    const content = (commentDrafts[postId] ?? "").trim();
    if (!content || !currentUserId || busyPostId !== null) return;

    setBusyPostId(postId);
    setErrorMessage("");

    const { error } = await supabase.from("post_comments").insert({
      post_id: postId,
      user_id: currentUserId,
      content,
    });

    if (error) {
      setErrorMessage(`Comentariul nu a putut fi publicat: ${error.message}`);
    } else {
      setCommentDrafts((current) => ({ ...current, [postId]: "" }));
      await loadFeed();
    }

    setBusyPostId(null);
  }

  async function deleteComment(comment: Comment) {
    if (comment.user_id !== currentUserId || busyPostId !== null) return;

    setBusyPostId(comment.post_id);
    setErrorMessage("");

    const { error } = await supabase
      .from("post_comments")
      .delete()
      .eq("id", comment.id)
      .eq("user_id", currentUserId);

    if (error) {
      setErrorMessage(`Comentariul nu a putut fi șters: ${error.message}`);
    } else {
      await loadFeed();
    }

    setBusyPostId(null);
  }

  function beginEditing(post: Post) {
    setEditingPostId(post.id);
    setEditingText(post.content);
  }

  async function saveEdit(post: Post) {
    const content = editingText.trim();
    if ((!content && !post.image_path) || post.user_id !== currentUserId) return;

    setBusyPostId(post.id);
    setErrorMessage("");

    const { error } = await supabase
      .from("posts")
      .update({
        content,
        updated_at: new Date().toISOString(),
      })
      .eq("id", post.id)
      .eq("user_id", currentUserId);

    if (error) {
      setErrorMessage(`Postarea nu a putut fi editată: ${error.message}`);
    } else {
      setEditingPostId(null);
      setEditingText("");
      await loadFeed();
    }

    setBusyPostId(null);
  }

  async function deletePost(post: Post) {
    if (post.user_id !== currentUserId || busyPostId !== null) return;

    const confirmed = window.confirm("Ștergi această postare?");
    if (!confirmed) return;

    setBusyPostId(post.id);
    setErrorMessage("");

    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("id", post.id)
      .eq("user_id", currentUserId);

    if (error) {
      setErrorMessage(`Postarea nu a putut fi ștearsă: ${error.message}`);
      setBusyPostId(null);
      return;
    }

    if (post.image_path) {
      await supabase.storage.from("post-images").remove([post.image_path]);
    }

    setBusyPostId(null);
    await loadFeed();
  }

  async function sharePost(post: Post) {
    if (!currentUserId || busyPostId !== null) return;

    const sharedId = post.shared_post_id ?? post.id;
    setBusyPostId(post.id);
    setErrorMessage("");

    const { error } = await supabase.from("posts").insert({
      user_id: currentUserId,
      content: "",
      shared_post_id: sharedId,
    });

    if (error) {
      setErrorMessage(`Postarea nu a putut fi distribuită: ${error.message}`);
    } else {
      await loadFeed();
    }

    setBusyPostId(null);
  }

  return (
    <div className="aurora-feed-page">
      <div className="aurora-feed-glow aurora-feed-glow-one" aria-hidden="true" />
      <div className="aurora-feed-glow aurora-feed-glow-two" aria-hidden="true" />
      <div className="aurora-feed-glow aurora-feed-glow-three" aria-hidden="true" />

      <FeedLayout
        left={<FriendsLocationMap />}
        right={<OnlineFriendsCard />}
      >
        <div className="aurora-feed-main friends-feed-center-column">
          <section className="friends-feed-composer-slot">
        {errorMessage && (
          <div className="aurora-feed-alert">
            {errorMessage}
          </div>
        )}

        <AuroraComposer
  postText={postText}
  selectedImage={selectedImage}
  previewUrl={previewUrl}
  publishing={publishing}
  imageInputRef={imageInputRef}
  onPostTextChange={setPostText}
  onImageSelect={handleImageSelect}
  onDroppedImage={selectImageFile}
  onRemoveImage={() => {
    setSelectedImage(null);

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }}
  onPublish={handlePublish}
/>
          </section>

          <section className="friends-feed-stories-slot" aria-label="Stories">
            <StoryBar currentUserId={currentUserId} />
          </section>

          <section className="friends-feed-reels-slot" aria-label="Reels">
            <FeedReelsStrip currentUserId={currentUserId} />
          </section>

        <section className="aurora-feed-section aurora-feed-section-compact friends-feed-posts-slot">
          <h2 className="aurora-feed-heading aurora-feed-heading-hidden">Postări</h2>

          {loadingPosts ? (
            <div className="aurora-feed-state">
              Se încarcă postările...
            </div>
          ) : posts.length === 0 ? (
            <div className="aurora-feed-state">
              Nu există încă postări.
            </div>
          ) : (
            <div className="aurora-post-list">
              {posts.map((post) => {
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

                return (
                  <article
                    key={post.id}
                    className="aurora-post-card aurora-premium-post"
                  >
                    <div className="aurora-post-accent" aria-hidden="true" />

                    <header className="aurora-post-header aurora-premium-post-header">
                      <div className="aurora-post-identity">
                        <div className="aurora-post-avatar-ring">
                          <div className="aurora-post-avatar">
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
                        </div>

                        <div className="aurora-post-author-block">
                          <div className="aurora-post-author-line">
                            <p className="aurora-post-author">
                              {getDisplayName(post.profiles)}
                            </p>
                            <span className="aurora-post-verified" title="Membru Friends">
                              ✦
                            </span>
                          </div>
                          <p className="aurora-post-time">
                            <span>{formatRelativeDate(post.created_at)}</span>
                            {post.updated_at ? <span> · editat</span> : null}
                            <span className="aurora-post-visibility" title="Vizibil prietenilor">
                              ◉
                            </span>
                          </p>
                        </div>
                      </div>

                      {post.user_id === currentUserId && (
                        <div className="aurora-post-owner-actions">
                          <button
                            type="button"
                            onClick={() => beginEditing(post)}
                            className="aurora-owner-action aurora-owner-action-edit"
                            title="Editează postarea"
                          >
                            <span aria-hidden="true">✎</span>
                            <span>Editează</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void deletePost(post)}
                            disabled={busyPostId === post.id}
                            className="aurora-owner-action aurora-owner-action-delete"
                            title="Șterge postarea"
                          >
                            <span aria-hidden="true">⌫</span>
                            <span>Șterge</span>
                          </button>
                        </div>
                      )}
                    </header>

                    <div className="aurora-post-body">
                      {editingPostId === post.id ? (
                        <div className="aurora-edit-panel">
                          <label className="aurora-edit-label" htmlFor={`edit-post-${post.id}`}>
                            Editează postarea
                          </label>
                          <textarea
                            id={`edit-post-${post.id}`}
                            value={editingText}
                            onChange={(event) => setEditingText(event.target.value)}
                            className="aurora-edit-textarea"
                            maxLength={5000}
                          />
                          <div className="aurora-edit-actions">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPostId(null);
                                setEditingText("");
                              }}
                              className="aurora-secondary-button"
                            >
                              Renunță
                            </button>
                            <button
                              type="button"
                              onClick={() => void saveEdit(post)}
                              disabled={busyPostId === post.id}
                              className="aurora-primary-button"
                            >
                              {busyPostId === post.id ? "Se salvează..." : "Salvează"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        post.content && (
                          <p className="aurora-post-content">{post.content}</p>
                        )
                      )}

                      {post.image_path && imageUrls[post.image_path] && (
                        <div className="aurora-post-media">
                          <img
                            src={imageUrls[post.image_path]}
                            alt="Fotografie din postare"
                            className="aurora-post-image"
                            loading="lazy"
                          />
                          <div className="aurora-post-media-shine" aria-hidden="true" />
                        </div>
                      )}

                      {post.shared_post && (
                        <div className="aurora-shared-post">
                          <div className="aurora-shared-label">
                            <span aria-hidden="true">↗</span>
                            Postare distribuită
                          </div>

                          <div className="aurora-shared-header">
                            <div className="aurora-shared-avatar">
                              {post.shared_post.profiles?.avatar_url ? (
                                <img
                                  src={post.shared_post.profiles.avatar_url}
                                  alt=""
                                />
                              ) : (
                                getInitials(post.shared_post.profiles)
                              )}
                            </div>
                            <div>
                              <p className="aurora-post-author">
                                {getDisplayName(post.shared_post.profiles)}
                              </p>
                              <p className="aurora-post-time">
                                {formatRelativeDate(post.shared_post.created_at)}
                              </p>
                            </div>
                          </div>

                          {post.shared_post.content && (
                            <p className="aurora-shared-content">
                              {post.shared_post.content}
                            </p>
                          )}

                          {post.shared_post.image_path &&
                            imageUrls[post.shared_post.image_path] && (
                              <div className="aurora-shared-media">
                                <img
                                  src={imageUrls[post.shared_post.image_path]}
                                  alt="Fotografie distribuită"
                                  loading="lazy"
                                />
                              </div>
                            )}
                        </div>
                      )}
                    </div>

                    {(reactionCounts.length > 0 || postComments.length > 0) && (
                      <div className="aurora-post-meta">
                        <div className="aurora-reaction-summary">
                          {reactionCounts.map((item) => (
                            <span
                              key={item.reaction}
                              className="aurora-reaction-count"
                              title={`${item.count} reacții`}
                            >
                              <span aria-hidden="true">{item.reaction}</span>
                              <strong>{item.count}</strong>
                            </span>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setOpenCommentsPostId((current) =>
                              current === post.id ? null : post.id
                            )
                          }
                          className="aurora-comment-count-button"
                        >
                          <span>{postComments.length}</span>{" "}
                          {postComments.length === 1 ? "comentariu" : "comentarii"}
                        </button>
                      </div>
                    )}

                    <div className="aurora-post-actions">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenReactionPostId((current) =>
                            current === post.id ? null : post.id
                          )
                        }
                        className={`aurora-post-action ${
                          myReaction ? "aurora-post-action-active" : ""
                        }`}
                        aria-expanded={openReactionPostId === post.id}
                      >
                        <span className="aurora-action-icon" aria-hidden="true">
                          {myReaction?.reaction ?? "♡"}
                        </span>
                        <span>{myReaction ? "Reacția ta" : "Reacționează"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setOpenCommentsPostId((current) =>
                            current === post.id ? null : post.id
                          )
                        }
                        className={`aurora-post-action ${
                          openCommentsPostId === post.id
                            ? "aurora-post-action-active"
                            : ""
                        }`}
                        aria-expanded={openCommentsPostId === post.id}
                      >
                        <span className="aurora-action-icon" aria-hidden="true">◌</span>
                        <span>Comentează</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void sharePost(post)}
                        disabled={busyPostId === post.id}
                        className="aurora-post-action"
                      >
                        <span className="aurora-action-icon" aria-hidden="true">↗</span>
                        <span>
                          {busyPostId === post.id ? "Se distribuie..." : "Distribuie"}
                        </span>
                      </button>

                      {openReactionPostId === post.id && (
                        <div className="aurora-reaction-picker">
                          <span className="aurora-picker-label">Alege o reacție</span>
                          <div className="aurora-picker-options">
                            {REACTIONS.map((reaction) => (
                              <button
                                key={reaction}
                                type="button"
                                onClick={() => void toggleReaction(post.id, reaction)}
                                disabled={busyPostId === post.id}
                                className={`aurora-reaction-option ${
                                  myReaction?.reaction === reaction
                                    ? "aurora-reaction-option-active"
                                    : ""
                                }`}
                                title={reaction}
                              >
                                {reaction}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {openCommentsPostId === post.id && (
                      <div className="aurora-comments">
                        <div className="aurora-comments-heading">
                          <div>
                            <span className="aurora-comments-kicker">CONVERSAȚIE</span>
                            <h3>Comentarii</h3>
                          </div>
                          <span className="aurora-comments-total">
                            {postComments.length}
                          </span>
                        </div>

                        <div className="aurora-comment-list">
                          {postComments.length === 0 && (
                            <div className="aurora-comments-empty">
                              <span aria-hidden="true">✦</span>
                              <p>Fii primul care lasă un comentariu.</p>
                            </div>
                          )}

                          {postComments.map((comment) => (
                            <div key={comment.id} className="aurora-comment-row">
                              <div className="aurora-comment-avatar">
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

                              <div className="aurora-comment-content">
                                <div className="aurora-comment-bubble">
                                  <div className="aurora-comment-topline">
                                    <p className="aurora-comment-author">
                                      {getDisplayName(comment.profiles)}
                                    </p>

                                    {comment.user_id === currentUserId && (
                                      <button
                                        type="button"
                                        onClick={() => void deleteComment(comment)}
                                        disabled={busyPostId === post.id}
                                        className="aurora-comment-delete"
                                        title="Șterge comentariul"
                                      >
                                        Șterge
                                      </button>
                                    )}
                                  </div>

                                  <p className="aurora-comment-text">
                                    {comment.content}
                                  </p>
                                </div>

                                <span className="aurora-comment-time">
                                  {formatRelativeDate(comment.created_at)}
                                  {comment.updated_at ? " · editat" : ""}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>

                        <form
                          onSubmit={(event) => void addComment(event, post.id)}
                          className="aurora-comment-form"
                        >
                          <div className="aurora-comment-compose-avatar" aria-hidden="true">
                            ✦
                          </div>
                          <div className="aurora-comment-input-wrap">
                            <input
                              value={commentDrafts[post.id] ?? ""}
                              onChange={(event) =>
                                setCommentDrafts((current) => ({
                                  ...current,
                                  [post.id]: event.target.value,
                                }))
                              }
                              maxLength={2000}
                              placeholder="Scrie un comentariu..."
                              className="aurora-comment-input"
                            />
                            <span className="aurora-comment-limit">
                              {(commentDrafts[post.id] ?? "").length}/2000
                            </span>
                          </div>
                          <button
                            type="submit"
                            disabled={
                              busyPostId === post.id ||
                              !(commentDrafts[post.id] ?? "").trim()
                            }
                            className="aurora-comment-submit"
                          >
                            <span>Trimite</span>
                            <span aria-hidden="true">→</span>
                          </button>
                        </form>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
        </div>
      </FeedLayout>
    </div>
  );
}