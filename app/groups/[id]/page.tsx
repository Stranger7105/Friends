"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Plus,
  Search,
  Trash2,
  X,
  Download,
  Files,
  Image as ImageIcon,
  MessageCircle,
  Phone,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import GroupCallButtons from "@/components/groups/GroupCallButtons";
import type { CallContact } from "@/components/calls/callTypes";
import type { GroupRole } from "@/components/groups/groupTypes";
import "@/styles/friends-groups.css";

type GroupRow = {
  id: number;
  conversation_id: number;
  name: string;
  description: string | null;
  avatar_url: string | null;
  owner_id: string;
};

type MemberRow = {
  user_id: string;
  role: GroupRole;
  joined_at: string;
};

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type FriendshipRow = {
  user_id: string;
  friend_id: string;
};

type ManageableFriend = ProfileRow;

type DisplayMember = CallContact & {
  username: string | null;
  role: GroupRole;
  joinedAt: string;
};

type SharedMessage = {
  id: number;
  sender_id: string;
  content: string;
  image_path: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  attachment_size: number | null;
  created_at: string;
};

type TabId = "overview" | "chat" | "gallery" | "files" | "members" | "calls";

function nameOf(profile: ProfileRow) {
  return profile.full_name || profile.username || "Prieten Friends";
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function roleLabel(role: GroupRole) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "moderator") return "Moderator";
  return "Membru";
}

function formatSize(bytes: number | null) {
  if (!bytes) return "Fișier";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function GroupDetailsPage() {
  const params = useParams<{ id: string }>();
  const groupId = Number(params.id);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [currentUserId, setCurrentUserId] = useState("");
  const [group, setGroup] = useState<GroupRow | null>(null);
  const [members, setMembers] = useState<DisplayMember[]>([]);
  const [sharedMessages, setSharedMessages] = useState<SharedMessage[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<number, string>>({});
  const [fileUrls, setFileUrls] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [memberManagerOpen, setMemberManagerOpen] = useState(false);
  const [availableFriends, setAvailableFriends] = useState<ManageableFriend[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberActionBusy, setMemberActionBusy] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState("");
  const [memberMessage, setMemberMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadGroup() {
      if (!Number.isFinite(groupId) || groupId <= 0) {
        setError("Grupul nu este valid.");
        setLoading(false);
        return;
      }

      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;

      if (!user) {
        setError("Trebuie să fii autentificat.");
        setLoading(false);
        return;
      }

      const [groupResult, membershipResult] = await Promise.all([
        supabase
          .from("groups")
          .select("id, conversation_id, name, description, avatar_url, owner_id")
          .eq("id", groupId)
          .maybeSingle(),
        supabase
          .from("group_members")
          .select("user_id, role, joined_at")
          .eq("group_id", groupId),
      ]);

      if (cancelled) return;

      if (groupResult.error || !groupResult.data) {
        setError(groupResult.error?.message || "Grupul nu există sau nu ai acces la el.");
        setLoading(false);
        return;
      }

      if (membershipResult.error) {
        setError(membershipResult.error.message);
        setLoading(false);
        return;
      }

      const memberRows = (membershipResult.data || []) as MemberRow[];
      if (!memberRows.some((member) => member.user_id === user.id)) {
        setError("Nu ești membru al acestui grup.");
        setLoading(false);
        return;
      }

      const memberIds = memberRows.map((member) => member.user_id);
      const [profilesResult, messagesResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", memberIds),
        supabase
          .from("messages")
          .select(
            "id, sender_id, content, image_path, attachment_path, attachment_name, attachment_type, attachment_size, created_at",
          )
          .eq("conversation_id", Number(groupResult.data.conversation_id))
          .or("image_path.not.is.null,attachment_path.not.is.null")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (profilesResult.error) {
        setError(profilesResult.error.message);
        setLoading(false);
        return;
      }

      const profileMap = new Map(
        ((profilesResult.data || []) as ProfileRow[]).map((profile) => [profile.id, profile]),
      );
      const rank: Record<GroupRole, number> = { owner: 0, admin: 1, moderator: 2, member: 3 };
      const contacts = memberRows
        .map((member) => {
          const profile = profileMap.get(member.user_id);
          if (!profile) return null;
          return {
            id: profile.id,
            name: nameOf(profile),
            avatarUrl: profile.avatar_url,
            username: profile.username,
            role: member.role,
            joinedAt: member.joined_at,
          } satisfies DisplayMember;
        })
        .filter((member): member is DisplayMember => member !== null)
        .sort((a, b) => rank[a.role] - rank[b.role] || a.name.localeCompare(b.name, "ro"));

      setCurrentUserId(user.id);
      setGroup(groupResult.data as GroupRow);
      setMembers(contacts);
      setSharedMessages(messagesResult.error ? [] : ((messagesResult.data || []) as SharedMessage[]));
      setLoading(false);
    }

    void loadGroup();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  useEffect(() => {
    let cancelled = false;

    async function loadSignedUrls() {
      const nextImages: Record<number, string> = {};
      const nextFiles: Record<number, string> = {};

      await Promise.all(
        sharedMessages.map(async (message) => {
          if (message.image_path) {
            const { data } = await supabase.storage
              .from("chat-images")
              .createSignedUrl(message.image_path, 3600);
            if (data?.signedUrl) nextImages[message.id] = data.signedUrl;
          }
          if (message.attachment_path) {
            const { data } = await supabase.storage
              .from("chat-files")
              .createSignedUrl(message.attachment_path, 3600);
            if (data?.signedUrl) nextFiles[message.id] = data.signedUrl;
          }
        }),
      );

      if (!cancelled) {
        setImageUrls(nextImages);
        setFileUrls(nextFiles);
      }
    }

    if (sharedMessages.length) void loadSignedUrls();
    return () => {
      cancelled = true;
    };
  }, [sharedMessages]);

  const invitees = useMemo(
    () => members.filter((member) => member.id !== currentUserId),
    [members, currentUserId],
  );
  const gallery = useMemo(
    () => sharedMessages.filter((message) => message.image_path),
    [sharedMessages],
  );
  const files = useMemo(
    () => sharedMessages.filter((message) => message.attachment_path),
    [sharedMessages],
  );


  const currentMember = useMemo(
    () => members.find((member) => member.id === currentUserId),
    [members, currentUserId],
  );

  const canManageMembers =
    currentMember?.role === "owner" ||
    currentMember?.role === "admin" ||
    group?.owner_id === currentUserId;

  const visibleAvailableFriends = useMemo(() => {
    const value = memberSearch.trim().toLocaleLowerCase("ro-RO");

    if (!value) return availableFriends;

    return availableFriends.filter((friend) => {
      const haystack = `${friend.full_name || ""} ${friend.username || ""}`
        .toLocaleLowerCase("ro-RO");

      return haystack.includes(value);
    });
  }, [availableFriends, memberSearch]);

  async function loadAvailableFriends() {
    if (!currentUserId) return;

    setMemberMessage("");
    setMemberActionBusy(true);

    const friendshipsResult = await supabase
      .from("friends")
      .select("user_id, friend_id")
      .or(`user_id.eq.${currentUserId},friend_id.eq.${currentUserId}`);

    if (friendshipsResult.error) {
      setMemberMessage(
        `Prietenii nu au putut fi încărcați: ${friendshipsResult.error.message}`,
      );
      setMemberActionBusy(false);
      return;
    }

    const friendships =
      (friendshipsResult.data || []) as FriendshipRow[];

    const existingMemberIds = new Set(
      members.map((member) => member.id),
    );

    const friendIds = Array.from(
      new Set(
        friendships.map((friendship) =>
          friendship.user_id === currentUserId
            ? friendship.friend_id
            : friendship.user_id,
        ),
      ),
    ).filter((id) => !existingMemberIds.has(id));

    if (friendIds.length === 0) {
      setAvailableFriends([]);
      setMemberActionBusy(false);
      return;
    }

    const profilesResult = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .in("id", friendIds)
      .order("full_name", { ascending: true });

    if (profilesResult.error) {
      setMemberMessage(
        `Profilurile nu au putut fi încărcate: ${profilesResult.error.message}`,
      );
    } else {
      setAvailableFriends(
        (profilesResult.data || []) as ManageableFriend[],
      );
    }

    setMemberActionBusy(false);
  }

  function openMemberManager() {
    setSelectedFriendIds([]);
    setMemberSearch("");
    setMemberMessage("");
    setMemberManagerOpen(true);
    void loadAvailableFriends();
  }

  function toggleSelectedFriend(friendId: string) {
    setSelectedFriendIds((current) =>
      current.includes(friendId)
        ? current.filter((id) => id !== friendId)
        : [...current, friendId],
    );
  }

  async function addSelectedFriends() {
    if (
      !group ||
      selectedFriendIds.length === 0 ||
      memberActionBusy
    ) {
      return;
    }

    setMemberActionBusy(true);
    setMemberMessage("");

    const { error: rpcError } = await supabase.rpc(
      "add_friends_group_members",
      {
        target_group_id: group.id,
        selected_member_ids: selectedFriendIds,
      },
    );

    if (rpcError) {
      setMemberMessage(
        `Membrii nu au putut fi adăugați: ${rpcError.message}`,
      );
      setMemberActionBusy(false);
      return;
    }

    const addedProfiles = availableFriends.filter((friend) =>
      selectedFriendIds.includes(friend.id),
    );

    const addedMembers: DisplayMember[] = addedProfiles.map(
      (profile) => ({
        id: profile.id,
        name: nameOf(profile),
        avatarUrl: profile.avatar_url,
        username: profile.username,
        role: "member",
        joinedAt: new Date().toISOString(),
      }),
    );

    setMembers((current) =>
      [...current, ...addedMembers].sort((a, b) =>
        a.name.localeCompare(b.name, "ro"),
      ),
    );

    setAvailableFriends((current) =>
      current.filter(
        (friend) => !selectedFriendIds.includes(friend.id),
      ),
    );
    setSelectedFriendIds([]);
    setMemberMessage("Prietenii selectați au fost adăugați în grup.");
    setMemberActionBusy(false);
  }

  async function removeMember(member: DisplayMember) {
    if (
      !group ||
      member.id === group.owner_id ||
      member.id === currentUserId ||
      removingMemberId
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Îl elimini pe ${member.name} din grup?`,
    );

    if (!confirmed) return;

    setRemovingMemberId(member.id);
    setMemberMessage("");

    const { error: rpcError } = await supabase.rpc(
      "remove_friends_group_member",
      {
        target_group_id: group.id,
        target_user_id: member.id,
      },
    );

    if (rpcError) {
      setMemberMessage(
        `Membrul nu a putut fi eliminat: ${rpcError.message}`,
      );
      setRemovingMemberId("");
      return;
    }

    setMembers((current) =>
      current.filter((item) => item.id !== member.id),
    );

    setMemberMessage(`${member.name} a fost eliminat din grup.`);
    setRemovingMemberId("");

    if (memberManagerOpen) {
      void loadAvailableFriends();
    }
  }

  const tabs: Array<{ id: TabId; label: string; icon: typeof Users }> = [
    { id: "overview", label: "Grup", icon: ShieldCheck },
    { id: "chat", label: "Chat", icon: MessageCircle },
    { id: "gallery", label: `Galerie (${gallery.length})`, icon: ImageIcon },
    { id: "files", label: `Fișiere (${files.length})`, icon: Files },
    { id: "members", label: `Membri (${members.length})`, icon: Users },
    { id: "calls", label: "Apeluri", icon: Phone },
  ];

  return (
    <main className="friends-group-detail-page">
      <section className="friends-group-detail-shell">
        <Link href="/groups" className="friends-group-back">
          <ArrowLeft size={18} /> Înapoi la grupuri
        </Link>

        {loading && <div className="friends-groups-state">Se încarcă grupul…</div>}
        {error && <div className="friends-groups-state is-error">{error}</div>}

        {!loading && !error && group && (
          <>
            <header className="friends-group-hero">
              <div className="friends-group-hero-icon">
                {group.avatar_url ? <img src={group.avatar_url} alt="" /> : <Users size={34} />}
              </div>
              <div className="friends-group-hero-copy">
                <span>GRUP FRIENDS</span>
                <h1>{group.name}</h1>
                <p>{group.description || `${members.length} membri în acest spațiu.`}</p>
                <small>{members.length} membri · conversație #{group.conversation_id}</small>
              </div>
              <GroupCallButtons
                conversationId={Number(group.conversation_id)}
                members={invitees}
                disabled={invitees.length === 0}
              />
            </header>

            <nav className="friends-group-tabs" aria-label="Secțiunile grupului">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={activeTab === tab.id ? "is-active" : ""}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <Icon size={18} /> {tab.label}
                  </button>
                );
              })}
            </nav>

            {activeTab === "overview" && (
              <section className="friends-group-dashboard">
                <article className="friends-group-panel friends-group-welcome-panel">
                  <span className="friends-group-eyebrow">SPAȚIU COMUN</span>
                  <h2>Bun venit în {group.name}</h2>
                  <p>
                    Chatul, fotografiile, documentele, membrii și apelurile grupului sunt reunite
                    aici. Tot conținutul rămâne legat de conversația grupului.
                  </p>
                  <div className="friends-group-quick-actions">
                    <Link href={`/messages/${group.conversation_id}`} className="friends-group-chat-link">
                      <MessageCircle size={18} /> Deschide chatul
                    </Link>
                    <button type="button" onClick={() => setActiveTab("gallery")}>
                      <ImageIcon size={18} /> Vezi galeria
                    </button>
                    <button type="button" onClick={() => setActiveTab("files")}>
                      <Files size={18} /> Vezi fișierele
                    </button>
                  </div>
                </article>

                <aside className="friends-group-stats-panel">
                  <div><Users size={21} /><strong>{members.length}</strong><span>Membri</span></div>
                  <div><ImageIcon size={21} /><strong>{gallery.length}</strong><span>Fotografii</span></div>
                  <div><Files size={21} /><strong>{files.length}</strong><span>Fișiere</span></div>
                  <div><CalendarDays size={21} /><strong>Activ</strong><span>Spațiu Friends</span></div>
                </aside>
              </section>
            )}

            {activeTab === "chat" && (
              <section className="friends-group-panel friends-group-centered-panel">
                <MessageCircle size={44} />
                <h2>Conversația grupului</h2>
                <p>Mesaje în timp real, reacții, fotografii, documente, audio și locație.</p>
                <Link href={`/messages/${group.conversation_id}`} className="friends-group-chat-link">
                  Deschide conversația completă
                </Link>
              </section>
            )}

            {activeTab === "gallery" && (
              <section className="friends-group-panel">
                <div className="friends-group-section-heading">
                  <div><span>MEDIA</span><h2>Galeria grupului</h2></div>
                  <small>{gallery.length} elemente</small>
                </div>
                {gallery.length === 0 ? (
                  <div className="friends-group-empty-section">Fotografiile trimise în chat vor apărea aici.</div>
                ) : (
                  <div className="friends-group-gallery-grid">
                    {gallery.map((message) => (
                      <button
                        type="button"
                        key={message.id}
                        onClick={() => imageUrls[message.id] && window.open(imageUrls[message.id], "_blank", "noopener,noreferrer")}
                      >
                        {imageUrls[message.id] ? <img src={imageUrls[message.id]} alt={message.content || "Fotografie de grup"} /> : <span>Se încarcă…</span>}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}

            {activeTab === "files" && (
              <section className="friends-group-panel">
                <div className="friends-group-section-heading">
                  <div><span>DOCUMENTE</span><h2>Fișierele grupului</h2></div>
                  <small>{files.length} fișiere</small>
                </div>
                {files.length === 0 ? (
                  <div className="friends-group-empty-section">Documentele distribuite în chat vor apărea aici.</div>
                ) : (
                  <div className="friends-group-files-list">
                    {files.map((message) => (
                      <a
                        key={message.id}
                        href={fileUrls[message.id] || undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={!fileUrls[message.id] ? "is-loading" : ""}
                      >
                        <div className="friends-group-file-icon"><Files size={22} /></div>
                        <div><strong>{message.attachment_name || "Document"}</strong><span>{formatSize(message.attachment_size)} · {new Date(message.created_at).toLocaleDateString("ro-RO")}</span></div>
                        <Download size={19} />
                      </a>
                    ))}
                  </div>
                )}
              </section>
            )}

            {activeTab === "members" && (
              <section className="friends-group-panel">
                <div
                  className="friends-group-section-heading"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div>
                    <span>COMUNITATE</span>
                    <h2>Membrii grupului</h2>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <small>{members.length} membri</small>

                    {canManageMembers && (
                      <button
                        type="button"
                        onClick={openMemberManager}
                        style={{
                          minHeight: 42,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "0 14px",
                          border: 0,
                          borderRadius: 14,
                          background: "var(--friends-primary)",
                          color: "#ffffff",
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        <Plus size={18} />
                        Adaugă prieteni
                      </button>
                    )}
                  </div>
                </div>

                {memberMessage && (
                  <div
                    style={{
                      marginBottom: 14,
                      padding: "10px 12px",
                      borderRadius: 12,
                      background: "rgba(16,185,129,0.12)",
                      border: "1px solid rgba(16,185,129,0.3)",
                    }}
                  >
                    {memberMessage}
                  </div>
                )}

                <div className="friends-group-members-grid">
                  {members.map((member) => {
                    const removable =
                      canManageMembers &&
                      member.id !== group.owner_id &&
                      member.id !== currentUserId;

                    return (
                      <div
                        key={member.id}
                        className="friends-group-member-card"
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "auto minmax(0, 1fr)",
                          gridAutoFlow: "row",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <div className="friends-group-member-avatar">
                          {member.avatarUrl ? (
                            <img src={member.avatarUrl} alt="" />
                          ) : (
                            initials(member.name)
                          )}
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <strong
                            style={{
                              display: "block",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {member.name}
                          </strong>
                          <span
                            style={{
                              display: "block",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            @{member.username || "friends"}
                          </span>
                          <em className={`role-${member.role}`}>
                            {roleLabel(member.role)}
                            {member.id === currentUserId ? " · Tu" : ""}
                          </em>
                        </div>

                        {removable && (
                          <button
                            type="button"
                            disabled={removingMemberId === member.id}
                            onClick={() => void removeMember(member)}
                            aria-label={`Elimină ${member.name} din grup`}
                            title="Elimină din grup"
                            style={{
                              minHeight: 40,
                              gridColumn: "1 / -1",
                              width: "100%",
                              flexShrink: 0,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 7,
                              padding: "0 11px",
                              borderRadius: 12,
                              border:
                                "1px solid rgba(248,113,113,0.38)",
                              background:
                                "rgba(239,68,68,0.14)",
                              color: "#fca5a5",
                              fontSize: 13,
                              fontWeight: 800,
                              cursor: "pointer",
                              opacity:
                                removingMemberId === member.id
                                  ? 0.55
                                  : 1,
                            }}
                          >
                            <Trash2 size={17} />
                            <span>
                              {removingMemberId === member.id
                                ? "Se elimină…"
                                : "Elimină"}
                            </span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {!canManageMembers && (
                  <p
                    style={{
                      marginTop: 14,
                      fontSize: 13,
                      opacity: 0.7,
                    }}
                  >
                    Doar owner-ul sau un administrator poate modifica membrii grupului.
                  </p>
                )}
              </section>
            )}

            {memberManagerOpen && (
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Adaugă prieteni în grup"
                onClick={() => {
                  if (!memberActionBusy) {
                    setMemberManagerOpen(false);
                  }
                }}
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 100000,
                  display: "grid",
                  placeItems: "center",
                  padding:
                    "max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom))",
                  background: "rgba(0,0,0,0.72)",
                }}
              >
                <section
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    width: "min(620px, 100%)",
                    maxHeight: "min(760px, 92dvh)",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    borderRadius: 24,
                    background:
                      "var(--friends-surface, #101a20)",
                    color: "var(--friends-text, #fff)",
                    border:
                      "1px solid var(--friends-border, rgba(255,255,255,0.14))",
                    boxShadow:
                      "0 24px 80px rgba(0,0,0,0.45)",
                  }}
                >
                  <header
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: 16,
                      borderBottom:
                        "1px solid var(--friends-border, rgba(255,255,255,0.12))",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: 20 }}>
                        Adaugă prieteni
                      </strong>
                      <div
                        style={{
                          marginTop: 3,
                          fontSize: 13,
                          opacity: 0.7,
                        }}
                      >
                        {selectedFriendIds.length} selectați
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={memberActionBusy}
                      onClick={() =>
                        setMemberManagerOpen(false)
                      }
                      aria-label="Închide"
                      style={{
                        width: 42,
                        height: 42,
                        display: "grid",
                        placeItems: "center",
                        border: 0,
                        borderRadius: "50%",
                        background: "rgba(255,255,255,0.08)",
                        color: "inherit",
                        cursor: "pointer",
                      }}
                    >
                      <X size={20} />
                    </button>
                  </header>

                  <div style={{ padding: 14 }}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        padding: "0 12px",
                        minHeight: 46,
                        borderRadius: 14,
                        border:
                          "1px solid var(--friends-border, rgba(255,255,255,0.12))",
                        background:
                          "var(--friends-surface-strong, rgba(255,255,255,0.06))",
                      }}
                    >
                      <Search size={18} />
                      <input
                        value={memberSearch}
                        onChange={(event) =>
                          setMemberSearch(event.target.value)
                        }
                        placeholder="Caută un prieten…"
                        style={{
                          minWidth: 0,
                          flex: 1,
                          border: 0,
                          outline: 0,
                          background: "transparent",
                          color: "inherit",
                          fontSize: 16,
                        }}
                      />
                    </label>
                  </div>

                  <div
                    style={{
                      minHeight: 160,
                      flex: 1,
                      overflowY: "auto",
                      overscrollBehavior: "contain",
                      padding: "0 14px 14px",
                    }}
                  >
                    {memberActionBusy &&
                    availableFriends.length === 0 ? (
                      <div
                        style={{
                          padding: 24,
                          textAlign: "center",
                          opacity: 0.7,
                        }}
                      >
                        Se încarcă prietenii…
                      </div>
                    ) : visibleAvailableFriends.length === 0 ? (
                      <div
                        style={{
                          padding: 24,
                          textAlign: "center",
                          opacity: 0.7,
                        }}
                      >
                        {availableFriends.length === 0
                          ? "Toți prietenii tăi sunt deja în acest grup."
                          : "Nu am găsit niciun prieten."}
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "grid",
                          gap: 9,
                        }}
                      >
                        {visibleAvailableFriends.map(
                          (friend) => {
                            const selected =
                              selectedFriendIds.includes(
                                friend.id,
                              );
                            const friendName =
                              nameOf(friend);

                            return (
                              <button
                                key={friend.id}
                                type="button"
                                onClick={() =>
                                  toggleSelectedFriend(
                                    friend.id,
                                  )
                                }
                                style={{
                                  width: "100%",
                                  display: "grid",
                                  gridTemplateColumns:
                                    "48px minmax(0,1fr) 34px",
                                  alignItems: "center",
                                  gap: 11,
                                  padding: 10,
                                  borderRadius: 16,
                                  border: selected
                                    ? "1px solid var(--friends-primary)"
                                    : "1px solid var(--friends-border, rgba(255,255,255,0.12))",
                                  background: selected
                                    ? "color-mix(in srgb, var(--friends-primary) 16%, var(--friends-surface))"
                                    : "var(--friends-surface-strong, rgba(255,255,255,0.05))",
                                  color: "inherit",
                                  textAlign: "left",
                                  cursor: "pointer",
                                }}
                              >
                                <div
                                  style={{
                                    width: 48,
                                    height: 48,
                                    display: "grid",
                                    placeItems: "center",
                                    overflow: "hidden",
                                    borderRadius: "50%",
                                    background:
                                      "var(--friends-primary)",
                                    color: "#fff",
                                    fontWeight: 800,
                                  }}
                                >
                                  {friend.avatar_url ? (
                                    <img
                                      src={friend.avatar_url}
                                      alt=""
                                      style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                      }}
                                    />
                                  ) : (
                                    initials(friendName)
                                  )}
                                </div>

                                <div style={{ minWidth: 0 }}>
                                  <strong
                                    style={{
                                      display: "block",
                                      overflow: "hidden",
                                      textOverflow:
                                        "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {friendName}
                                  </strong>
                                  {friend.username && (
                                    <span
                                      style={{
                                        display: "block",
                                        marginTop: 2,
                                        fontSize: 13,
                                        opacity: 0.65,
                                        overflow: "hidden",
                                        textOverflow:
                                          "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      @{friend.username}
                                    </span>
                                  )}
                                </div>

                                <span
                                  style={{
                                    width: 30,
                                    height: 30,
                                    display: "grid",
                                    placeItems: "center",
                                    borderRadius: "50%",
                                    border:
                                      "1px solid var(--friends-border, rgba(255,255,255,0.18))",
                                    background: selected
                                      ? "var(--friends-primary)"
                                      : "transparent",
                                    color: selected
                                      ? "#fff"
                                      : "inherit",
                                  }}
                                >
                                  {selected ? (
                                    <Check size={17} />
                                  ) : (
                                    <Plus size={17} />
                                  )}
                                </span>
                              </button>
                            );
                          },
                        )}
                      </div>
                    )}

                    {memberMessage && (
                      <div
                        style={{
                          marginTop: 10,
                          padding: 10,
                          borderRadius: 12,
                          background:
                            "rgba(16,185,129,0.12)",
                        }}
                      >
                        {memberMessage}
                      </div>
                    )}
                  </div>

                  <footer
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: 10,
                      padding: 14,
                      borderTop:
                        "1px solid var(--friends-border, rgba(255,255,255,0.12))",
                    }}
                  >
                    <button
                      type="button"
                      disabled={memberActionBusy}
                      onClick={() =>
                        setMemberManagerOpen(false)
                      }
                      style={{
                        minHeight: 44,
                        padding: "0 16px",
                        borderRadius: 14,
                        border:
                          "1px solid var(--friends-border, rgba(255,255,255,0.16))",
                        background: "transparent",
                        color: "inherit",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Închide
                    </button>

                    <button
                      type="button"
                      disabled={
                        memberActionBusy ||
                        selectedFriendIds.length === 0
                      }
                      onClick={() =>
                        void addSelectedFriends()
                      }
                      style={{
                        minHeight: 44,
                        padding: "0 17px",
                        borderRadius: 14,
                        border: 0,
                        background:
                          "var(--friends-primary)",
                        color: "#fff",
                        fontWeight: 800,
                        cursor: "pointer",
                        opacity:
                          memberActionBusy ||
                          selectedFriendIds.length === 0
                            ? 0.5
                            : 1,
                      }}
                    >
                      {memberActionBusy
                        ? "Se adaugă…"
                        : `Adaugă (${selectedFriendIds.length})`}
                    </button>
                  </footer>
                </section>
              </div>
            )}

            {activeTab === "calls" && (
              <section className="friends-group-panel friends-group-centered-panel">
                <Phone size={44} />
                <h2>Apeluri de grup</h2>
                <p>Pornește un apel audio sau video cu membrii acestui grup.</p>
                <GroupCallButtons
                  conversationId={Number(group.conversation_id)}
                  members={invitees}
                  disabled={invitees.length === 0}
                />
              </section>
            )}
          </>
        )}
      </section>
    </main>
  );
}
