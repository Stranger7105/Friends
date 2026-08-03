"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function useCurrentUser() {
  const [userId, setUserId] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (mounted && user) {
        setUserId(user.id);
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  return userId;
}