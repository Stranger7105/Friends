"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Phone, Search, Users, Video, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import "@/styles/friends-call-center.css";

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type GroupConversation = {
  id: number;
  title: string;
  memberCount: number;
};

type Props = {
  open: boolean;
  currentUserId: string;
  onClose: () => void;
  onStartPersonCall: (input: {
    contact: { id: string; name: string; avatarUrl: string | null };
    conversationId: number;
    kind: CallKind;
  }) => Promise<void> | void;
};

type Tab = "people" | "groups";
type CallKind = "audio" | "video";

function displayName(profile: Profile) {
  return profile.full_name || profile.username || "Utilizator Friends";
}

function initials(profile: Profile) {
  return displayName(profile)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function GlobalCallLauncher({ open, currentUserId, onClose, onStartPersonCall }: Props) {
  const [tab, setTab] = useState<Tab>("people");
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Profile[]>([]);
  const [groups, setGroups] = useState<GroupConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [startingKey, setStartingKey] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !currentUserId) return;

    let cancelled = false;

    async function loadContacts() {
      setLoading(true);
      setError("");

      const memberships = await supabase
        .from("conversation_members")
        .select("conversation_id, user_id");

      if (cancelled) return;

      if (memberships.error) {
        setError(`Contactele nu au putut fi încărcate: ${memberships.error.message}`);
        setLoading(false);
        return;
      }

      const rows = memberships.data || [];
      const myConversationIds = new Set(
        rows
          .filter((row) => row.user_id === currentUserId)
          .map((row) => Number(row.conversation_id)),
      );

      const relevantRows = rows.filter((row) =>
        myConversationIds.has(Number(row.conversation_id)),
      );

      const otherIds = Array.from(
        new Set(
          relevantRows
            .map((row) => String(row.user_id))
            .filter((id) => id && id !== currentUserId),
        ),
      );

      if (otherIds.length > 0) {
        const profilesResult = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", otherIds)
          .order("full_name", { ascending: true });

        if (!cancelled && !profilesResult.error) {
          setPeople((profilesResult.data || []) as Profile[]);
        }
      } else {
        setPeople([]);
      }

      const membersByConversation = new Map<number, string[]>();
      for (const row of relevantRows) {
        const id = Number(row.conversation_id);
        const list = membersByConversation.get(id) || [];
        list.push(String(row.user_id));
        membersByConversation.set(id, list);
      }

      const groupList = Array.from(membersByConversation.entries())
        .filter(([, members]) => members.length > 2)
        .map(([id, members]) => ({
          id,
          title: `Grup Friends #${id}`,
          memberCount: members.length,
        }));

      if (!cancelled) {
        setGroups(groupList);
        setLoading(false);
      }
    }

    void loadContacts();
    return () => { cancelled = true; };
  }, [currentUserId, open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setError("");
      setStartingKey("");
    }
  }, [open]);

  const filteredPeople = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return people;
    return people.filter((profile) =>
      `${profile.full_name || ""} ${profile.username || ""}`.toLowerCase().includes(value),
    );
  }, [people, query]);

  const filteredGroups = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return groups;
    return groups.filter((group) => group.title.toLowerCase().includes(value));
  }, [groups, query]);

  async function findDirectConversation(otherUserId: string) {
    const mine = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", currentUserId);

    if (mine.error) throw mine.error;

    const ids = (mine.data || []).map((row) => Number(row.conversation_id));
    if (!ids.length) return null;

    const theirs = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", otherUserId)
      .in("conversation_id", ids);

    if (theirs.error) throw theirs.error;

    for (const row of theirs.data || []) {
      const conversationId = Number(row.conversation_id);
      const countResult = await supabase
        .from("conversation_members")
        .select("user_id", { count: "exact", head: true })
        .eq("conversation_id", conversationId);

      if (!countResult.error && countResult.count === 2) return conversationId;
    }

    return null;
  }

  async function startPersonCall(profile: Profile, kind: CallKind) {
    const key = `${profile.id}-${kind}`;
    setStartingKey(key);
    setError("");

    try {
      const conversationId = await findDirectConversation(profile.id);
      if (!conversationId) {
        setError(`Nu există încă o conversație directă cu ${displayName(profile)}.`);
        return;
      }

      await onStartPersonCall({
        contact: {
          id: profile.id,
          name: displayName(profile),
          avatarUrl: profile.avatar_url,
        },
        conversationId,
        kind,
      });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Apelul nu a putut fi pregătit.");
    } finally {
      setStartingKey("");
    }
  }

  function startGroupCall(group: GroupConversation, kind: CallKind) {
    void group;
    void kind;
    setError("Apelurile de grup sunt pregătite în listă și vor fi activate în pachetul C3.");
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="friends-call-center-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.section
            className="friends-call-center"
            initial={{ opacity: 0, y: 22, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 330, damping: 28 }}
            role="dialog"
            aria-modal="true"
            aria-label="Centrul de apeluri Friends"
          >
            <div className="friends-call-center-header">
              <div>
                <span className="friends-call-center-kicker">FRIENDS CALLS</span>
                <h2>Pe cine apelezi?</h2>
              </div>
              <button type="button" onClick={onClose} aria-label="Închide"><X size={21} /></button>
            </div>

            <div className="friends-call-tabs">
              <button type="button" className={tab === "people" ? "is-active" : ""} onClick={() => setTab("people")}>
                <Phone size={17} /> Persoane
              </button>
              <button type="button" className={tab === "groups" ? "is-active" : ""} onClick={() => setTab("groups")}>
                <Users size={18} /> Grupuri
              </button>
            </div>

            <label className="friends-call-search">
              <Search size={18} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === "people" ? "Caută o persoană..." : "Caută un grup..."} />
            </label>

            {error && <p className="friends-call-error">{error}</p>}

            <div className="friends-call-list">
              {loading && <p className="friends-call-empty">Se încarcă...</p>}

              {!loading && tab === "people" && filteredPeople.map((profile) => (
                <article key={profile.id} className="friends-call-row">
                  <div className="friends-call-avatar">
                    {profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : initials(profile)}
                  </div>
                  <div className="friends-call-person-copy">
                    <strong>{displayName(profile)}</strong>
                    <span>{profile.username ? `@${profile.username}` : "Contact Friends"}</span>
                  </div>
                  <div className="friends-call-actions">
                    <button type="button" disabled={Boolean(startingKey)} onClick={() => void startPersonCall(profile, "audio")} title="Apel audio"><Phone size={19} /></button>
                    <button type="button" disabled={Boolean(startingKey)} onClick={() => void startPersonCall(profile, "video")} title="Apel video"><Video size={20} /></button>
                  </div>
                </article>
              ))}

              {!loading && tab === "groups" && filteredGroups.map((group) => (
                <article key={group.id} className="friends-call-row">
                  <div className="friends-call-avatar friends-call-group-avatar"><Users size={22} /></div>
                  <div className="friends-call-person-copy">
                    <strong>{group.title}</strong>
                    <span>{group.memberCount} participanți</span>
                  </div>
                  <div className="friends-call-actions">
                    <button type="button" onClick={() => startGroupCall(group, "audio")} title="Apel audio de grup"><Phone size={19} /></button>
                    <button type="button" onClick={() => startGroupCall(group, "video")} title="Apel video de grup"><Video size={20} /></button>
                  </div>
                </article>
              ))}

              {!loading && tab === "people" && filteredPeople.length === 0 && <p className="friends-call-empty">Nu am găsit persoane în conversațiile tale.</p>}
              {!loading && tab === "groups" && filteredGroups.length === 0 && <p className="friends-call-empty">Nu ai încă o conversație cu minimum 3 membri.</p>}
            </div>

            <p className="friends-call-note">Selectarea deschide conversația și pregătește tipul de apel ales.</p>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
