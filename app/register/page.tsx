"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (password !== confirmPassword) {
      setMessage("Parolele nu sunt identice.");
      return;
    }

    if (password.length < 6) {
      setMessage("Parola trebuie să aibă cel puțin 6 caractere.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    });

    setLoading(false);

    if (error) {
      setMessage(`Eroare: ${error.message}`);
      return;
    }

    setMessage("Contul a fost creat. Verifică e-mailul pentru confirmare.");

    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
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

        <h1 className="text-3xl font-bold">Creează cont</h1>

        <p className="mt-2 text-slate-400">
          Completează datele pentru a te înregistra.
        </p>

        <form onSubmit={handleRegister} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Nume
            </label>

            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-violet-500"
              placeholder="Numele tău"
            />
          </div>

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
              minLength={6}
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-violet-500"
              placeholder="Minimum 6 caractere"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Confirmă parola
            </label>

            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={6}
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-violet-500"
              placeholder="Scrie parola din nou"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-violet-600 px-4 py-3 font-semibold transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Se creează contul..." : "Creează cont"}
          </button>

          {message && (
            <p className="rounded-xl bg-white/10 p-3 text-center text-sm">
              {message}
            </p>
          )}
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Ai deja cont?{" "}
          <Link href="/login" className="text-violet-400 hover:underline">
            Conectează-te
          </Link>
        </p>
      </div>
    </main>
  );
}