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
import FeedPost from "@/components/aurora/feed/FeedPost";
import type {
  Comment,
  Post,
  Profile,
  Reaction,
  ReactionValue,
} from "@/components/aurora/feed/feed-types";
import "@/styles/aurora-feed.css";
import "@/styles/aurora-feed-v2.css";
import "@/styles/aurora-feed-v3.css";
import "@/styles/aurora-stories.css";
import AppearanceButton from "@/components/AppearanceButton";
import { supabase } from "@/lib/supabase";

function getProfileInitials(profile: Profile | null) {
  const source = profile?.full_name?.trim() || profile?.username?.trim() || "F";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export default function FeedPage() {
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
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

    const currentProfileResult = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    if (currentProfileResult.error) {
      setErrorMessage(
        `Profilul tău nu a putut fi încărcat: ${currentProfileResult.error.message}`
      );
    } else {
      setCurrentProfile((currentProfileResult.data as Profile | null) ?? null);
    }

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

  const currentUserPosts = useMemo(
    () => posts.filter((post) => post.user_id === currentUserId).length,
    [posts, currentUserId]
  );

  const receivedReactions = useMemo(() => {
    const ownPostIds = new Set(
      posts.filter((post) => post.user_id === currentUserId).map((post) => post.id)
    );

    return reactions.filter((reaction) => ownPostIds.has(reaction.post_id)).length;
  }, [posts, reactions, currentUserId]);

  const displayName =
    currentProfile?.full_name?.trim() ||
    currentProfile?.username?.trim() ||
    "Profilul tău";

  return (
    <div className="aurora-page aurora-feed-page aurora-feed-motion-page relative min-h-screen overflow-x-hidden">
      <div className="aurora-feed-glow aurora-feed-glow-one" aria-hidden="true" />
      <div className="aurora-feed-glow aurora-feed-glow-two" aria-hidden="true" />
      <div className="aurora-feed-glow aurora-feed-glow-three" aria-hidden="true" />


      <main className="aurora-feed-shell aurora-feed-layout">
        <aside className="aurora-feed-leftbar" aria-label="Navigare rapidă">
          <section className="aurora-left-profile-card aurora-profile-panel">
            <div className="aurora-profile-cover" aria-hidden="true" />

            <div className="aurora-profile-avatar-wrap">
              <div className="aurora-profile-avatar">
                {currentProfile?.avatar_url ? (
                  <img src={currentProfile.avatar_url} alt={displayName} />
                ) : (
                  <span>{getProfileInitials(currentProfile)}</span>
                )}
              </div>
              <span className="aurora-profile-online-dot" title="Online" />
            </div>

            <div className="aurora-profile-identity">
              <span className="aurora-sidebar-kicker">PROFILUL TĂU</span>
              <h2>{displayName}</h2>
              <p>
                {currentProfile?.username
                  ? `@${currentProfile.username}`
                  : "Cont Friends activ"}
              </p>
            </div>

            <div className="aurora-profile-stats" aria-label="Statistici profil">
              <div>
                <strong>{currentUserPosts}</strong>
                <span>Postări</span>
              </div>
              <div>
                <strong>{receivedReactions}</strong>
                <span>Reacții</span>
              </div>
              <div>
                <strong>{comments.filter((comment) => comment.user_id === currentUserId).length}</strong>
                <span>Comentarii</span>
              </div>
            </div>

            <Link href="/profile" className="aurora-profile-open-button">
              Vezi profilul
              <span aria-hidden="true">→</span>
            </Link>
          </section>

          <nav className="aurora-quick-nav" aria-label="Scurtături">
            <Link href="/feed" className="aurora-quick-link aurora-quick-link-active">
              <span>⌂</span><strong>Feed</strong>
            </Link>
            <Link href="/people" className="aurora-quick-link">
              <span>✦</span><strong>Descoperă</strong>
            </Link>
            <Link href="/friends" className="aurora-quick-link">
              <span>◉</span><strong>Prieteni</strong>
            </Link>
            <Link href="/messages" className="aurora-quick-link">
              <span>◌</span><strong>Conversații</strong>
            </Link>
            <Link href="/notifications" className="aurora-quick-link">
              <span>◇</span><strong>Noutăți</strong>
            </Link>
          </nav>

          <Link href="/settings/appearance" className="aurora-left-note aurora-appearance-link">
            <span className="aurora-left-note-icon">✺</span>
            <div>
              <strong>Aspect și teme</strong>
              <p>Personalizează Friends după stilul tău.</p>
            </div>
            <span className="aurora-left-note-arrow" aria-hidden="true">→</span>
          </Link>
        </aside>

        <div className="aurora-feed-main min-w-0">
          <section className="aurora-feed-hero group relative isolate overflow-hidden rounded-[34px] border border-white/80 bg-white/55 px-6 py-7 text-slate-900 shadow-[0_32px_90px_-48px_rgba(5,150,105,0.45)] backdrop-blur-3xl sm:px-8 sm:py-9">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_8%_0%,rgba(52,211,153,0.24),transparent_34%),radial-gradient(circle_at_82%_15%,rgba(14,165,233,0.18),transparent_30%),linear-gradient(125deg,rgba(255,255,255,0.72)_0%,rgba(240,253,250,0.58)_52%,rgba(239,246,255,0.62)_100%)]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-24 top-2 -z-10 h-52 w-[520px] rotate-[-9deg] rounded-[100%] bg-gradient-to-r from-emerald-400/0 via-emerald-300/30 to-sky-300/0 blur-2xl transition duration-700 group-hover:translate-x-16"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute bottom-[-70px] right-[-45px] -z-10 h-52 w-52 rounded-full border border-emerald-200/35 bg-emerald-300/18 blur-sm"
            />

            <div className="relative flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <span className="aurora-feed-eyebrow !text-emerald-700/70">
                  FEED PERSONAL
                </span>
                <h1 className="mt-2 !text-slate-900">
                  Momentele prietenilor tăi
                </h1>
                <p className="mt-2 max-w-xl !text-slate-600">
                  Descoperă ce este nou, păstrează legătura și lasă un semn acolo unde contează.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-white/80 bg-white/55 px-4 py-3 shadow-sm backdrop-blur-xl">
                  <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                    Comunitate
                  </span>
                  <span className="mt-1 block text-sm font-black text-slate-900">
                    {posts.length} momente
                  </span>
                </div>

                <div className="aurora-feed-hero-badge !border-emerald-300/45 !bg-emerald-100/70 !text-emerald-800">
                  <span className="aurora-live-dot" aria-hidden="true" />
                  LIVE
                </div>
              </div>
            </div>
          </section>

          <div className="relative z-10 -mt-2">
            <StoryBar currentUserId={currentUserId} />
          </div>

          {errorMessage && (
            <div className="aurora-feed-alert" role="alert">
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

          <section className="aurora-feed-section">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700/55">
                  FLUXUL TĂU
                </span>
                <h2 className="aurora-feed-heading !mb-0">Postări recente</h2>
              </div>

              <div className="hidden items-center gap-2 rounded-full border border-white/70 bg-white/55 px-3 py-2 text-xs font-bold text-slate-500 shadow-sm backdrop-blur-xl sm:flex">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Actualizare în timp real
              </div>
            </div>

            {loadingPosts ? (
              <div className="aurora-feed-skeleton-list" aria-label="Se încarcă postările">
                {[0, 1, 2].map((item) => (
                  <article key={item} className="aurora-feed-skeleton-card">
                    <div className="aurora-feed-skeleton-head">
                      <span className="aurora-feed-skeleton-avatar" />
                      <div className="aurora-feed-skeleton-lines">
                        <span />
                        <span />
                      </div>
                    </div>
                    <span className="aurora-feed-skeleton-text aurora-feed-skeleton-text-wide" />
                    <span className="aurora-feed-skeleton-text" />
                    <span className="aurora-feed-skeleton-media" />
                    <div className="aurora-feed-skeleton-actions">
                      <span />
                      <span />
                      <span />
                    </div>
                  </article>
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="aurora-feed-state">
                Nu există încă postări. Publică primul moment din Friends.
              </div>
            ) : (
              <div className="aurora-post-list aurora-post-motion-list">
                {posts.map((post) => (
                  <FeedPost
                    key={post.id}
                    post={post}
                    reactions={reactions}
                    comments={comments}
                    currentUserId={currentUserId}
                    imageUrls={imageUrls}
                    busyPostId={busyPostId}
                    openReactionPostId={openReactionPostId}
                    openCommentsPostId={openCommentsPostId}
                    commentDraft={commentDrafts[post.id] ?? ""}
                    editingPostId={editingPostId}
                    editingText={editingText}
                    onOpenReactionChange={setOpenReactionPostId}
                    onOpenCommentsChange={setOpenCommentsPostId}
                    onCommentDraftChange={(postId, value) =>
                      setCommentDrafts((current) => ({
                        ...current,
                        [postId]: value,
                      }))
                    }
                    onEditingTextChange={setEditingText}
                    onCancelEditing={() => {
                      setEditingPostId(null);
                      setEditingText("");
                    }}
                    onBeginEditing={beginEditing}
                    onSaveEdit={saveEdit}
                    onDeletePost={deletePost}
                    onSharePost={sharePost}
                    onToggleReaction={toggleReaction}
                    onDeleteComment={deleteComment}
                    onAddComment={addComment}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="aurora-feed-rightbar" aria-label="Rezumat feed">
          <section className="aurora-sidebar-card aurora-sidebar-welcome relative overflow-hidden">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-lime-300/15 blur-2xl"
            />
            <span className="aurora-sidebar-kicker">ACUM ÎN FRIENDS</span>
            <h3>Comunitatea ta respiră</h3>
            <p>Vezi activitatea din feed fără să pierzi ceea ce contează.</p>
          </section>

          <section className="aurora-sidebar-card">
            <div className="aurora-sidebar-title-row">
              <h3>Activitate</h3>
              <span className="aurora-live-dot" />
            </div>

            <div className="aurora-sidebar-stats">
              <div>
                <strong>{posts.length}</strong>
                <span>Postări</span>
              </div>
              <div>
                <strong>{reactions.length}</strong>
                <span>Reacții</span>
              </div>
              <div>
                <strong>{comments.length}</strong>
                <span>Comentarii</span>
              </div>
            </div>
          </section>

          <section className="aurora-sidebar-card">
            <h3>Scurtături</h3>
            <div className="aurora-sidebar-links">
              <Link href="/people">Descoperă prieteni <span>→</span></Link>
              <Link href="/requests">Vezi cererile <span>→</span></Link>
              <Link href="/messages">Deschide mesajele <span>→</span></Link>
            </div>
          </section>

          <section className="aurora-sidebar-card hidden xl:block">
            <span className="aurora-sidebar-kicker">AURORA NOTE</span>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              O conversație sinceră valorează mai mult decât o sută de reacții grăbite.
            </p>
          </section>
        </aside>
      </main>
    </div>
  );
}