import { supabase } from "@/lib/supabase";
import type {
  CallKind,
  CallSessionRow,
  CallStatus,
} from "./types";

const CALL_SELECT =
  "id, conversation_id, caller_id, callee_id, kind, status, created_at, accepted_at, ended_at, updated_at";

function parseConversationId(value: string): number {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Conversația apelului nu este validă.");
  }

  return id;
}

export async function createCallSession(
  conversationId: string,
  callerId: string,
  calleeId: string,
  kind: CallKind = "audio"
): Promise<CallSessionRow> {
  if (!callerId || !calleeId || callerId === calleeId) {
    throw new Error("Participanții apelului nu sunt valizi.");
  }

  const numericConversationId = parseConversationId(conversationId);

  const { data: existing, error: existingError } = await supabase
    .from("call_sessions")
    .select(CALL_SELECT)
    .or(`caller_id.eq.${callerId},callee_id.eq.${callerId}`)
    .in("status", ["ringing", "accepted"])
    .order("created_at", { ascending: false })
    .limit(1);

  if (existingError) {
    throw new Error(
      `Starea apelurilor nu a putut fi verificată: ${existingError.message}`
    );
  }

  if ((existing ?? []).length > 0) {
    throw new Error("Ai deja un apel activ.");
  }

  const { data, error } = await supabase
    .from("call_sessions")
    .insert({
      conversation_id: numericConversationId,
      caller_id: callerId,
      callee_id: calleeId,
      kind,
      status: "ringing",
    })
    .select(CALL_SELECT)
    .single();

  if (error) {
    throw new Error(`Apelul nu a putut fi inițiat: ${error.message}`);
  }

  return data as CallSessionRow;
}

export async function updateCallStatus(
  callId: string,
  status: CallStatus
): Promise<CallSessionRow> {
  const patch: Record<string, string | null> = {
    status,
  };

  if (status === "accepted") {
    patch.accepted_at = new Date().toISOString();
  }

  if (
    status === "rejected" ||
    status === "cancelled" ||
    status === "ended"
  ) {
    patch.ended_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("call_sessions")
    .update(patch)
    .eq("id", callId)
    .select(CALL_SELECT)
    .single();

  if (error) {
    throw new Error(`Apelul nu a putut fi actualizat: ${error.message}`);
  }

  return data as CallSessionRow;
}

export async function getActiveCallForUser(
  userId: string
): Promise<CallSessionRow | null> {
  const { data, error } = await supabase
    .from("call_sessions")
    .select(CALL_SELECT)
    .or(`caller_id.eq.${userId},callee_id.eq.${userId}`)
    .in("status", ["ringing", "accepted"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Apelul activ nu a putut fi încărcat: ${error.message}`);
  }

  return (data as CallSessionRow | null) ?? null;
}

export async function getCallPeerProfile(userId: string): Promise<{
  fullName: string;
  avatarUrl?: string;
}> {
  const { data, error } = await supabase
    .from("profiles")
    .select("username, full_name, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Profilul participantului nu a putut fi încărcat: ${error.message}`);
  }

  return {
    fullName:
      data?.full_name?.trim() ||
      data?.username?.trim() ||
      "Prieten",
    avatarUrl: data?.avatar_url ?? undefined,
  };
}
