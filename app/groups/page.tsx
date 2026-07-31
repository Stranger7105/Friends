"use client";

import Link from "next/link";
import { Plus, Search, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { GroupSummary } from "@/components/groups/groupTypes";
import "@/styles/friends-groups.css";

type GroupRow = {
  id: number;
  conversation_id: number;
  name: string;
  description: string | null;
  avatar_url: string | null;
  owner_id: string;
  created_at: string;
};

type MembershipRow = {
  group_id: number;
  user_id: string;
};

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Trebuie să fii autentificat pentru a vedea grupurile.");
      setLoading(false);
      return;
    }

    const myMembershipsResult = await supabase
      .from("group_members")
      .select("group_id, user_id")
      .eq("user_id", user.id);

    if (myMembershipsResult.error) {
      setError(`Nu am putut încărca grupurile: ${myMembershipsResult.error.message}`);
      setLoading(false);
      return;
    }

    const myMemberships = (myMembershipsResult.data || []) as MembershipRow[];
    const groupIds = [...new Set(myMemberships.map((item) => Number(item.group_id)))];

    if (groupIds.length === 0) {
      setGroups([]);
      setLoading(false);
      return;
    }

    const [groupsResult, allMembershipsResult] = await Promise.all([
      supabase
        .from("groups")
        .select("id, conversation_id, name, description, avatar_url, owner_id, created_at")
        .in("id", groupIds)
        .order("updated_at", { ascending: false }),
      supabase
        .from("group_members")
        .select("group_id, user_id")
        .in("group_id", groupIds),
    ]);

    if (groupsResult.error) {
      setError(`Nu am putut încărca detaliile grupurilor: ${groupsResult.error.message}`);
      setLoading(false);
      return;
    }

    if (allMembershipsResult.error) {
      setError(`Nu am putut încărca membrii grupurilor: ${allMembershipsResult.error.message}`);
      setLoading(false);
      return;
    }

    const rows = (groupsResult.data || []) as GroupRow[];
    const memberships = (allMembershipsResult.data || []) as MembershipRow[];
    const countByGroup = new Map<number, number>();

    for (const membership of memberships) {
      const id = Number(membership.group_id);
      countByGroup.set(id, (countByGroup.get(id) || 0) + 1);
    }

    setGroups(
      rows.map((group) => ({
        id: Number(group.id),
        conversationId: Number(group.conversation_id),
        name: group.name,
        description: group.description,
        avatarUrl: group.avatar_url,
        ownerId: group.owner_id,
        memberCount: countByGroup.get(Number(group.id)) || 1,
        createdAt: group.created_at,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadGroups();

    const channel = supabase
      .channel("friends-groups-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "groups" }, () => {
        void loadGroups();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, () => {
        void loadGroups();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadGroups]);

  const filtered = useMemo(() => {
    const value = query.trim().toLocaleLowerCase("ro-RO");
    if (!value) return groups;

    return groups.filter((group) => {
      const haystack = `${group.name} ${group.description || ""}`.toLocaleLowerCase("ro-RO");
      return haystack.includes(value);
    });
  }, [groups, query]);

  return (
    <main className="friends-groups-page">
      <section className="friends-groups-shell">
        <header className="friends-groups-header">
          <div>
            <span>SPAȚIILE TALE</span>
            <h1>Grupuri</h1>
            <p>Discuții, fișiere și apeluri audio sau video direct din fiecare grup.</p>
          </div>

          <div className="friends-groups-header-actions">
            <div className="friends-groups-count">
              <Users size={21} /> {groups.length}
            </div>
            <Link href="/groups/new" className="friends-groups-create-button">
              <Plus size={20} /> Creează grup
            </Link>
          </div>
        </header>

        <label className="friends-groups-search">
          <Search size={19} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Caută după nume sau descriere…"
          />
        </label>

        {loading && <div className="friends-groups-state">Se încarcă grupurile…</div>}
        {error && <div className="friends-groups-state is-error">{error}</div>}

        {!loading && !error && groups.length === 0 && (
          <section className="friends-groups-empty">
            <div className="friends-groups-empty-icon">
              <Users size={42} />
            </div>
            <h2>Creează primul tău grup</h2>
            <p>Adună cel puțin doi prieteni într-un spațiu comun pentru chat, fișiere și apeluri.</p>
            <Link href="/groups/new" className="friends-groups-create-button is-large">
              <Plus size={21} /> Creează grup
            </Link>
          </section>
        )}

        {!loading && !error && groups.length > 0 && filtered.length === 0 && (
          <div className="friends-groups-state">Nu am găsit niciun grup pentru această căutare.</div>
        )}

        <div className="friends-groups-grid">
          {filtered.map((group) => (
            <Link key={group.id} href={`/groups/${group.id}`} className="friends-group-card">
              <div className="friends-group-card-icon">
                {group.avatarUrl ? <img src={group.avatarUrl} alt="" /> : <Users size={26} />}
              </div>
              <div className="friends-group-card-copy">
                <h2>{group.name}</h2>
                <p>{group.description || "Spațiu Friends pentru conversații și activități comune."}</p>
                <small>{group.memberCount} membri</small>
              </div>
              <span>Deschide</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
