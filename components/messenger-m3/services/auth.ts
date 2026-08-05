import { supabase } from "@/lib/supabase";

export async function getCurrentUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Utilizatorul nu este autentificat.");
  }

  return user.id;
}
