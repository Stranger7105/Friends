"use client";

import {
  AnimatePresence,
  motion,
} from "framer-motion";
import {
  Phone,
  Search,
  Users,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { getConversations } from "@/components/messenger-m3/services/conversations";
import type { MessengerConversation } from "@/components/messenger-m3/types";
import "@/styles/friends-call-center.css";

type PersonCallTarget = {
  contact: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  conversationId: number;
  kind: "audio";
};

type Props = {
  open: boolean;
  currentUserId: string;
  onClose: () => void;
  onStartPersonCall: (
    input: PersonCallTarget
  ) => Promise<void> | void;
};

type Tab = "people" | "groups";

function peerFromConversation(
  conversation: MessengerConversation,
  currentUserId: string
) {
  return conversation.members.find(
    (member) => member.userId !== currentUserId
  );
}

function initials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function GlobalCallLauncher({
  open,
  currentUserId,
  onClose,
  onStartPersonCall,
}: Props) {
  const [tab, setTab] = useState<Tab>("people");
  const [query, setQuery] = useState("");
  const [conversations, setConversations] = useState<
    MessengerConversation[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [startingId, setStartingId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !currentUserId) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const rows = await getConversations(currentUserId);

        if (!cancelled) {
          setConversations(rows);
        }
      } catch (reason) {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Conversațiile nu au putut fi încărcate."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setError("");
      setStartingId("");
    }
  }, [open]);

  const directConversations = useMemo(
    () =>
      conversations.filter(
        (conversation) =>
          conversation.type === "direct" &&
          Boolean(
            peerFromConversation(
              conversation,
              currentUserId
            )
          )
      ),
    [conversations, currentUserId]
  );

  const groupConversations = useMemo(
    () =>
      conversations.filter(
        (conversation) =>
          conversation.type === "group"
      ),
    [conversations]
  );

  const filteredPeople = useMemo(() => {
    const value = query.trim().toLowerCase();

    if (!value) return directConversations;

    return directConversations.filter(
      (conversation) => {
        const peer = peerFromConversation(
          conversation,
          currentUserId
        );
        const text =
          `${conversation.title} ${peer?.fullName ?? ""}`
            .toLowerCase();

        return text.includes(value);
      }
    );
  }, [
    currentUserId,
    directConversations,
    query,
  ]);

  const filteredGroups = useMemo(() => {
    const value = query.trim().toLowerCase();

    if (!value) return groupConversations;

    return groupConversations.filter(
      (conversation) =>
        conversation.title
          .toLowerCase()
          .includes(value)
    );
  }, [groupConversations, query]);

  async function startPersonCall(
    conversation: MessengerConversation
  ) {
    const peer = peerFromConversation(
      conversation,
      currentUserId
    );

    if (!peer) {
      setError(
        "Persoana din această conversație nu a putut fi identificată."
      );
      return;
    }

    const numericConversationId =
      Number(conversation.id);

    if (
      !Number.isInteger(numericConversationId) ||
      numericConversationId <= 0
    ) {
      setError(
        "Conversația nu are un identificator valid pentru apel."
      );
      return;
    }

    setStartingId(conversation.id);
    setError("");

    try {
      await onStartPersonCall({
        contact: {
          id: peer.userId,
          name:
            peer.fullName ||
            conversation.title ||
            "Prieten Friends",
          avatarUrl:
            peer.avatarUrl ?? null,
        },
        conversationId: numericConversationId,
        kind: "audio",
      });

      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Apelul nu a putut fi pornit."
      );
    } finally {
      setStartingId("");
    }
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
            if (
              event.target ===
              event.currentTarget
            ) {
              onClose();
            }
          }}
        >
          <motion.section
            className="friends-call-center"
            initial={{
              opacity: 0,
              y: 22,
              scale: 0.97,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              y: 16,
              scale: 0.98,
            }}
            transition={{
              type: "spring",
              stiffness: 330,
              damping: 28,
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Centrul de apeluri Friends"
          >
            <div className="friends-call-center-header">
              <div>
                <span className="friends-call-center-kicker">
                  FRIENDS CALLS
                </span>
                <h2>Pe cine apelezi?</h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Închide"
              >
                <X size={21} />
              </button>
            </div>

            <div className="friends-call-tabs">
              <button
                type="button"
                className={
                  tab === "people"
                    ? "is-active"
                    : ""
                }
                onClick={() =>
                  setTab("people")
                }
              >
                <Phone size={17} />
                Persoane
              </button>

              <button
                type="button"
                className={
                  tab === "groups"
                    ? "is-active"
                    : ""
                }
                onClick={() =>
                  setTab("groups")
                }
              >
                <Users size={18} />
                Grupuri
              </button>
            </div>

            <label className="friends-call-search">
              <Search size={18} />
              <input
                value={query}
                onChange={(event) =>
                  setQuery(event.target.value)
                }
                placeholder={
                  tab === "people"
                    ? "Caută o persoană..."
                    : "Caută un grup..."
                }
              />
            </label>

            {error && (
              <p className="friends-call-error">
                {error}
              </p>
            )}

            <div className="friends-call-list">
              {loading && (
                <p className="friends-call-empty">
                  Se încarcă...
                </p>
              )}

              {!loading &&
                tab === "people" &&
                filteredPeople.map(
                  (conversation) => {
                    const peer =
                      peerFromConversation(
                        conversation,
                        currentUserId
                      );

                    if (!peer) return null;

                    const displayName =
                      peer.fullName ||
                      conversation.title ||
                      "Prieten Friends";

                    return (
                      <button
                        key={conversation.id}
                        type="button"
                        disabled={Boolean(startingId)}
                        onClick={() =>
                          void startPersonCall(
                            conversation
                          )
                        }
                        className="friends-call-row"
                        style={{
                          width: "100%",
                          textAlign: "left",
                          cursor: "pointer",
                        }}
                      >
                        <div className="friends-call-avatar">
                          {peer.avatarUrl ? (
                            <img
                              src={peer.avatarUrl}
                              alt=""
                            />
                          ) : (
                            initials(displayName)
                          )}
                        </div>

                        <div className="friends-call-person-copy">
                          <strong>
                            {displayName}
                          </strong>
                          <span>
                            {startingId ===
                            conversation.id
                              ? "Se pregătește apelul..."
                              : "Apasă pentru apel audio"}
                          </span>
                        </div>

                        <div className="friends-call-actions">
                          <span
                            title="Apel audio"
                            style={{
                              width: 40,
                              height: 40,
                              display: "grid",
                              placeItems: "center",
                              borderRadius: "50%",
                              background:
                                "rgba(16,185,129,0.18)",
                              color: "#6ee7b7",
                            }}
                          >
                            <Phone size={19} />
                          </span>
                        </div>
                      </button>
                    );
                  }
                )}

              {!loading &&
                tab === "groups" &&
                filteredGroups.map(
                  (conversation) => (
                    <article
                      key={conversation.id}
                      className="friends-call-row"
                    >
                      <div className="friends-call-avatar friends-call-group-avatar">
                        <Users size={22} />
                      </div>

                      <div className="friends-call-person-copy">
                        <strong>
                          {conversation.title}
                        </strong>
                        <span>
                          {
                            conversation.members
                              .length
                          }{" "}
                          participanți
                        </span>
                      </div>

                      <div className="friends-call-actions">
                        <span
                          style={{
                            fontSize: 12,
                            opacity: 0.65,
                          }}
                        >
                          În M4.3
                        </span>
                      </div>
                    </article>
                  )
                )}

              {!loading &&
                tab === "people" &&
                filteredPeople.length === 0 && (
                  <p className="friends-call-empty">
                    Nu ai încă o conversație
                    directă disponibilă pentru
                    apel.
                  </p>
                )}

              {!loading &&
                tab === "groups" &&
                filteredGroups.length === 0 && (
                  <p className="friends-call-empty">
                    Nu ai grupuri disponibile.
                  </p>
                )}
            </div>

            <p className="friends-call-note">
              M4.1A: apelurile audio 1-la-1
              folosesc noul motor persistent.
              Apelurile de grup vor fi activate
              separat.
            </p>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
