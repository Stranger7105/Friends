import { supabase } from "@/lib/supabase";
import type {
  CallSignalRow,
  WebRtcSignalType,
} from "./types";

const SIGNAL_SELECT =
  "id, call_id, sender_id, recipient_id, signal_type, payload, created_at";

export async function insertWebRtcSignal(
  callId: string,
  senderId: string,
  recipientId: string,
  signalType: WebRtcSignalType,
  payload: Record<string, unknown>
): Promise<CallSignalRow> {
  const { data, error } = await supabase
    .from("call_signals")
    .insert({
      call_id: callId,
      sender_id: senderId,
      recipient_id: recipientId,
      signal_type: signalType,
      payload,
    })
    .select(SIGNAL_SELECT)
    .single();

  if (error) {
    throw new Error(
      `Semnalizarea WebRTC a eșuat: ${error.message}`
    );
  }

  return data as CallSignalRow;
}

export async function getWebRtcSignals(
  callId: string,
  recipientId: string
): Promise<CallSignalRow[]> {
  const { data, error } = await supabase
    .from("call_signals")
    .select(SIGNAL_SELECT)
    .eq("call_id", callId)
    .eq("recipient_id", recipientId)
    .order("id", { ascending: true });

  if (error) {
    throw new Error(
      `Semnalele WebRTC nu au putut fi încărcate: ${error.message}`
    );
  }

  return (data ?? []) as CallSignalRow[];
}

export async function clearWebRtcSignals(
  callId: string
): Promise<void> {
  const { error } = await supabase
    .from("call_signals")
    .delete()
    .eq("call_id", callId);

  if (error) {
    console.warn(
      "Semnalele apelului nu au putut fi curățate:",
      error.message
    );
  }
}
