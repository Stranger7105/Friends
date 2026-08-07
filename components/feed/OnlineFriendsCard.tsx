"use client";

import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  Check,
  Edit3,
  Expand,
  FolderPlus,
  MapPinned,
  Pencil,
  Trash2,
  X,
  MessageCircle,
  Minimize2,
  Search,
  Users,
  UsersRound,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type Friendship = {
  user_id: string;
  friend_id: string;
};

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  location_city: string | null;
};

type PresencePayload = {
  user_id: string;
  online_at: string;
};

type FriendGroup = {
  id: string;
  name: string;
};

type FriendGroupMember = {
  group_id: string;
  friend_id?: string;
};

function nameOf(profile: Profile) {
  return profile.full_name || profile.username || "Prieten Friends";
}

function initials(profile: Profile) {
  return nameOf(profile)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function cityOf(profile: Profile) {
  return profile.location_city || profile.city || "";
}

export default function OnlineFriendsCard() {
  const cardRef = useRef<HTMLElement | null>(null);

  const [currentUserId, setCurrentUserId] = useState("");
  const [friends, setFriends] = useState<Profile[]>([]);
  const [groups, setGroups] = useState<FriendGroup[]>([]);
  const [groupCounts, setGroupCounts] = useState<Record<string, number>>({});
  const [groupsOpen, setGroupsOpen] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [groupsError, setGroupsError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [createError, setCreateError] = useState("");
  const [membersOpen, setMembersOpen] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [membersError, setMembersError] = useState("");
  const [savingMembers, setSavingMembers] = useState(false);
  const [membersSuccess, setMembersSuccess] = useState("");

  const loadGroups = useCallback(async (userId: string) => {
    setGroupsLoading(true);
    setGroupsError("");

    const groupsResult = await supabase
      .from("friend_groups")
      .select("id, name")
      .eq("owner_id", userId)
      .order("name", { ascending: true });

    if (groupsResult.error) {
      setGroupsError("Grupurile nu au putut fi încărcate.");
      setGroupsLoading(false);
      return;
    }

    const nextGroups = (groupsResult.data || []) as FriendGroup[];
    setGroups(nextGroups);

    if (nextGroups.length === 0) {
      setGroupCounts({});
      setGroupsLoading(false);
      return;
    }

    const membersResult = await supabase
      .from("friend_group_members")
      .select("group_id")
      .in(
        "group_id",
        nextGroups.map((group) => group.id),
      );

    if (membersResult.error) {
      setGroupsError("Numărul membrilor nu a putut fi încărcat.");
      setGroupCounts({});
    } else {
      const counts: Record<string, number> = {};

      ((membersResult.data || []) as FriendGroupMember[]).forEach((member) => {
        counts[member.group_id] = (counts[member.group_id] || 0) + 1;
      });

      setGroupCounts(counts);
    }

    setGroupsLoading(false);
  }, []);

  const loadFriends = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setErrorMessage("Lista prietenilor nu poate fi încărcată.");
      setLoading(false);
      return;
    }

    setCurrentUserId(user.id);
    void loadGroups(user.id);

    const friendshipsResult = await supabase
      .from("friends")
      .select("user_id, friend_id")
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

    if (friendshipsResult.error) {
      setErrorMessage("Prietenii nu au putut fi încărcați.");
      setLoading(false);
      return;
    }

    const ids = [
      ...new Set(
        ((friendshipsResult.data || []) as Friendship[]).map((item) =>
          item.user_id === user.id ? item.friend_id : item.user_id,
        ),
      ),
    ];

    if (ids.length === 0) {
      setFriends([]);
      setLoading(false);
      return;
    }

    const profilesResult = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, city, location_city")
      .in("id", ids);

    if (profilesResult.error) {
      setErrorMessage("Profilurile prietenilor nu au putut fi încărcate.");
    } else {
      setFriends((profilesResult.data || []) as Profile[]);
    }

    setLoading(false);
  }, [loadGroups]);

  useEffect(() => {
    void loadFriends();

    const channel = supabase
      .channel("friends-card-data")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friends" },
        () => void loadFriends(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        () => void loadFriends(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_groups" },
        () => {
          if (currentUserId) void loadGroups(currentUserId);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_group_members" },
        () => {
          if (currentUserId) void loadGroups(currentUserId);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, loadFriends, loadGroups]);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase.channel("friends-feed-presence", {
      config: { presence: { key: currentUserId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresencePayload>();
        const ids = new Set(
          Object.values(state)
            .flat()
            .map((item) => item.user_id)
            .filter(Boolean),
        );

        ids.delete(currentUserId);
        setOnlineIds(ids);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: currentUserId,
            online_at: new Date().toISOString(),
          } satisfies PresencePayload);
        }
      });

    return () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === cardRef.current);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  async function toggleFullscreen() {
    const card = cardRef.current;
    if (!card) return;

    try {
      if (document.fullscreenElement === card) {
        await document.exitFullscreen();
      } else {
        await card.requestFullscreen({ navigationUI: "hide" });
      }
    } catch (error) {
      console.error(
        "Cardul Prieteni nu a putut schimba modul full-screen:",
        error,
      );
    }
  }


  async function createGroup() {
    const name = newGroupName.trim();

    if (!currentUserId || creatingGroup) return;

    if (!name) {
      setCreateError("Scrie un nume pentru grup.");
      return;
    }

    if (name.length > 50) {
      setCreateError("Numele grupului poate avea maximum 50 de caractere.");
      return;
    }

    setCreatingGroup(true);
    setCreateError("");

    const { error } = await supabase.from("friend_groups").insert({
      owner_id: currentUserId,
      name,
    });

    if (error) {
      setCreateError(`Grupul nu a putut fi creat: ${error.message}`);
      setCreatingGroup(false);
      return;
    }

    await loadGroups(currentUserId);
    setNewGroupName("");
    setCreateOpen(false);
    setCreatingGroup(false);
  }

  async function openMembersPreview() {
    if (!selectedGroup || membersLoading) return;

    setMembersOpen(true);
    setMembersLoading(true);
    setMembersError("");
    setMembersSuccess("");
    setMemberIds(new Set());

    const result = await supabase
      .from("friend_group_members")
      .select("friend_id")
      .eq("group_id", selectedGroup.id);

    if (result.error) {
      setMembersError(
        `Membrii grupului nu au putut fi încărcați: ${result.error.message}`,
      );
      setMembersLoading(false);
      return;
    }

    setMemberIds(
      new Set(
        ((result.data || []) as FriendGroupMember[])
          .map((member) => member.friend_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    setMembersLoading(false);
  }

  function toggleMemberPreview(friendId: string) {
    setMemberIds((current) => {
      const next = new Set(current);

      if (next.has(friendId)) {
        next.delete(friendId);
      } else {
        next.add(friendId);
      }

      return next;
    });
  }

  async function saveGroupMembers() {
    if (!selectedGroup || savingMembers) return;

    setSavingMembers(true);
    setMembersError("");
    setMembersSuccess("");

    const existingResult = await supabase
      .from("friend_group_members")
      .select("friend_id")
      .eq("group_id", selectedGroup.id);

    if (existingResult.error) {
      setMembersError(
        `Membrii existenți nu au putut fi citiți: ${existingResult.error.message}`,
      );
      setSavingMembers(false);
      return;
    }

    const existingIds = new Set(
      ((existingResult.data || []) as FriendGroupMember[])
        .map((member) => member.friend_id)
        .filter((id): id is string => Boolean(id)),
    );

    const selectedIds = new Set(memberIds);

    const idsToInsert = [...selectedIds].filter((id) => !existingIds.has(id));
    const idsToDelete = [...existingIds].filter((id) => !selectedIds.has(id));

    if (idsToInsert.length > 0) {
      const insertResult = await supabase
        .from("friend_group_members")
        .insert(
          idsToInsert.map((friendId) => ({
            group_id: selectedGroup.id,
            friend_id: friendId,
          })),
        );

      if (insertResult.error) {
        setMembersError(
          `Membrii noi nu au putut fi adăugați: ${insertResult.error.message}`,
        );
        setSavingMembers(false);
        return;
      }
    }

    if (idsToDelete.length > 0) {
      const deleteResult = await supabase
        .from("friend_group_members")
        .delete()
        .eq("group_id", selectedGroup.id)
        .in("friend_id", idsToDelete);

      if (deleteResult.error) {
        setMembersError(
          `Membrii eliminați nu au putut fi șterși: ${deleteResult.error.message}`,
        );
        setSavingMembers(false);
        return;
      }
    }

    await loadGroups(currentUserId);

    setMembersSuccess("Grupul a fost actualizat.");
    setSavingMembers(false);

    window.setTimeout(() => {
      setMembersOpen(false);
      setMembersSuccess("");
    }, 700);
  }

  const filteredFriends = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ro");

    return friends
      .filter((friend) => {
        if (!normalizedQuery) return true;

        return (
          nameOf(friend).toLocaleLowerCase("ro").includes(normalizedQuery) ||
          cityOf(friend).toLocaleLowerCase("ro").includes(normalizedQuery)
        );
      })
      .sort((a, b) => {
        const onlineDifference =
          Number(onlineIds.has(b.id)) - Number(onlineIds.has(a.id));

        if (onlineDifference !== 0) return onlineDifference;

        return nameOf(a).localeCompare(nameOf(b), "ro");
      });
  }, [friends, onlineIds, query]);

  const onlineCount = useMemo(
    () => friends.filter((friend) => onlineIds.has(friend.id)).length,
    [friends, onlineIds],
  );

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) || null,
    [groups, selectedGroupId],
  );

  return (
    <section
      ref={cardRef}
      className={`friends-dashboard-card friends-online-card friends-card-p1 ${
        isFullscreen ? "is-native-fullscreen" : ""
      }`}
    >
      <header className="friends-card-p1-header">
        <div>
          <span className="friends-card-p1-kicker">REȚEAUA TA</span>
          <h3>
            <Users size={20} />
            Prieteni
          </h3>
          <p>
            {friends.length} {friends.length === 1 ? "prieten" : "prieteni"}
            <span aria-hidden="true">•</span>
            <strong>{onlineCount} online</strong>
          </p>
        </div>

        <button
          type="button"
          className="friends-card-p1-expand"
          onClick={() => void toggleFullscreen()}
          aria-label={
            isFullscreen
              ? "Ieși din lista de prieteni pe tot ecranul"
              : "Deschide lista de prieteni pe tot ecranul"
          }
          title={isFullscreen ? "Ieși din full-screen" : "Full-screen"}
        >
          {isFullscreen ? <Minimize2 size={20} /> : <Expand size={20} />}
        </button>
      </header>

      <label className="friends-card-p1-search">
        <Search size={17} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Caută după nume sau oraș…"
          aria-label="Caută un prieten"
        />
      </label>

      <section
        className="friends-g11"
        style={{
          padding: 0,
          overflow: "hidden",
        }}
      >
        <Link
          href="/groups"
          style={{
            minHeight: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "10px 13px",
            borderRadius: 14,
            border:
              "1px solid var(--friends-border, rgba(255,255,255,0.12))",
            background:
              "var(--friends-surface-strong, rgba(255,255,255,0.06))",
            color: "inherit",
            textDecoration: "none",
            fontWeight: 800,
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 9,
            }}
          >
            <UsersRound size={18} />
            Grupurile mele
          </span>
          <span
            style={{
              fontSize: 13,
              opacity: 0.7,
            }}
          >
            Deschide →
          </span>
        </Link>
      </section>

      <div className="friends-card-p1-list">
        {loading ? (
          <div className="friends-card-p1-state">Se încarcă prietenii…</div>
        ) : errorMessage ? (
          <div className="friends-card-p1-state is-error">
            {errorMessage}
          </div>
        ) : filteredFriends.length === 0 ? (
          <div className="friends-card-p1-state">
            {query.trim()
              ? "Nu am găsit niciun prieten pentru această căutare."
              : "Nu ai încă prieteni în listă."}
          </div>
        ) : (
          filteredFriends.map((friend) => {
            const online = onlineIds.has(friend.id);
            const city = cityOf(friend);

            return (
              <article key={friend.id} className="friends-card-p1-row">
                <Link
                  href={`/profile/${friend.id}`}
                  className="friends-card-p1-profile"
                  aria-label={`Deschide profilul lui ${nameOf(friend)}`}
                >
                  <div className="friends-card-p1-avatar">
                    {friend.avatar_url ? (
                      <img src={friend.avatar_url} alt="" />
                    ) : (
                      <span>{initials(friend)}</span>
                    )}

                    <i
                      className={online ? "is-online" : ""}
                      aria-label={online ? "Online" : "Offline"}
                    />
                  </div>

                  <div className="friends-card-p1-details">
                    <strong>{nameOf(friend)}</strong>
                    <span className={online ? "is-online" : ""}>
                      {online ? "Online acum" : "Offline"}
                      {city ? ` • ${city}` : ""}
                    </span>
                  </div>
                </Link>

                <Link
                  href={`/messages/${friend.id}`}
                  className="friends-card-p1-message"
                  aria-label={`Trimite mesaj lui ${nameOf(friend)}`}
                  title="Mesaj"
                >
                  <MessageCircle size={18} />
                </Link>
              </article>
            );
          })
        )}
      </div>

      <footer className="friends-card-p1-footer">
        <Link href="/friends">
          Vezi pagina Prieteni
          <span aria-hidden="true">→</span>
        </Link>
      </footer>

      {membersOpen && selectedGroup && (
        <div
          className="friends-g13-members-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !membersLoading &&
              !savingMembers
            ) {
              setMembersOpen(false);
            }
          }}
        >
          <section
            className="friends-g13-members-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="friends-g13-members-title"
          >
            <header>
              <div>
                <span>MEMBRII GRUPULUI</span>
                <h2 id="friends-g13-members-title">{selectedGroup.name}</h2>
                <p>
                  Membrii existenți sunt deja bifați. În acest pas verificăm
                  doar încărcarea și selecția.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMembersOpen(false)}
                disabled={membersLoading || savingMembers}
                aria-label="Închide"
              >
                <X size={20} />
              </button>
            </header>

            <div className="friends-g13-members-summary">
              <span>Prieteni selectați</span>
              <strong>
                {memberIds.size} din {friends.length}
              </strong>
            </div>

            <div className="friends-g13-members-list">
              {membersLoading ? (
                <div className="friends-g13-members-state">
                  Se încarcă membrii grupului…
                </div>
              ) : membersError ? (
                <div className="friends-g13-members-state is-error">
                  {membersError}
                </div>
              ) : membersSuccess ? (
                <div className="friends-g13-members-state is-success">
                  {membersSuccess}
                </div>
              ) : friends.length === 0 ? (
                <div className="friends-g13-members-state">
                  Nu ai încă prieteni pe care să-i adaugi.
                </div>
              ) : (
                friends
                  .slice()
                  .sort((a, b) => nameOf(a).localeCompare(nameOf(b), "ro"))
                  .map((friend) => {
                    const checked = memberIds.has(friend.id);
                    const online = onlineIds.has(friend.id);

                    return (
                      <label
                        key={friend.id}
                        className={`friends-g13-member-row ${
                          checked ? "is-selected" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMemberPreview(friend.id)}
                          disabled={savingMembers}
                        />

                        <div className="friends-g13-member-avatar">
                          {friend.avatar_url ? (
                            <img src={friend.avatar_url} alt="" />
                          ) : (
                            <span>{initials(friend)}</span>
                          )}
                          <i className={online ? "is-online" : ""} />
                        </div>

                        <div className="friends-g13-member-details">
                          <strong>{nameOf(friend)}</strong>
                          <span>
                            {online ? "Online acum" : "Offline"}
                            {cityOf(friend) ? ` • ${cityOf(friend)}` : ""}
                          </span>
                        </div>

                        <span className="friends-g13-member-check">
                          {checked && <Check size={16} />}
                        </span>
                      </label>
                    );
                  })
              )}
            </div>

            <footer>
              <button
                type="button"
                className="is-secondary"
                onClick={() => setMembersOpen(false)}
                disabled={savingMembers}
              >
                Închide
              </button>

              <button
                type="button"
                className="is-primary"
                onClick={() => void saveGroupMembers()}
                disabled={savingMembers || membersLoading}
              >
                {savingMembers ? "Se salvează…" : "Salvează"}
              </button>
            </footer>
          </section>
        </div>
      )}

      {createOpen && (
        <div
          className="friends-g12-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !creatingGroup) {
              setCreateOpen(false);
            }
          }}
        >
          <section
            className="friends-g12-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="friends-g12-title"
          >
            <header>
              <div>
                <span>GRUP NOU</span>
                <h2 id="friends-g12-title">Creează grup</h2>
              </div>

              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                disabled={creatingGroup}
                aria-label="Închide"
              >
                <X size={20} />
              </button>
            </header>

            <label>
              <span>Numele grupului</span>
              <input
                autoFocus
                value={newGroupName}
                onChange={(event) => {
                  setNewGroupName(event.target.value);
                  if (createError) setCreateError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void createGroup();
                  }
                }}
                maxLength={50}
                placeholder="Exemplu: Familie"
                disabled={creatingGroup}
              />
              <small>{newGroupName.trim().length}/50</small>
            </label>

            {createError && <p className="friends-g12-error">{createError}</p>}

            <footer>
              <button
                type="button"
                className="is-secondary"
                onClick={() => setCreateOpen(false)}
                disabled={creatingGroup}
              >
                Anulează
              </button>
              <button
                type="button"
                className="is-primary"
                onClick={() => void createGroup()}
                disabled={creatingGroup || !newGroupName.trim()}
              >
                {creatingGroup ? "Se creează…" : "Creează"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
