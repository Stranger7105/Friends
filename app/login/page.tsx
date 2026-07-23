"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setMessage(`Eroare: ${error.message}`);
      return;
    }

    router.push("/feed");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
        <Link
          href="/"
          className="mb-8 inline-block text-2xl font-bold text-violet-400"
        >
          Friends
        </Link>

        <h1 className="text-3xl font-bold">Conectează-te</h1>

        <p className="mt-2 text-slate-400">
          Introdu datele contului tău.
        </p>

        <form onSubmit={handleLogin} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-sm text-slate-300">
              E-mail
            </label>

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-violet-500"
              placeholder="exemplu@email.com"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Parolă
            </label>

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-violet-500"
              placeholder="Parola ta"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-violet-600 px-4 py-3 font-semibold transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Se autentifică..." : "Conectează-te"}
          </button>

          {message && (
            <p className="rounded-xl bg-white/10 p-3 text-center text-sm">
              {message}
            </p>
          )}
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Nu ai cont?{" "}
          <Link href="/register" className="text-violet-400 hover:underline">
            Creează cont
          </Link>
        </p>
      </div>
    </main>
  );
}