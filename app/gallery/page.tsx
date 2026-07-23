"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function MyGalleryPage() {
  const router = useRouter();

  useEffect(() => {
    async function openOwnGallery() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      router.replace(user ? `/gallery/${user.id}` : "/login");
    }

    void openOwnGallery();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      Se deschide galeria...
    </main>
  );
}
