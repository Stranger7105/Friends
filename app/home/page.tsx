export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-100">
      {/* Bara de sus */}
      <header className="sticky top-0 z-50 border-b bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="text-2xl font-bold text-lime-400">
            Friends
          </div>

          <input
            type="text"
            placeholder="Caută pe Friends..."
            className="w-96 rounded-full border px-5 py-2 outline-none focus:border-emerald-400"
          />

          <div className="flex items-center gap-6 text-lg font-medium">
            <button>🏠</button>
            <button>👥</button>
            <button>💬</button>
            <button>🔔</button>
            <button>👤</button>
          </div>
        </div>
      </header>

      {/* Conținut */}
      <div className="mx-auto grid max-w-7xl grid-cols-12 gap-6 p-6">

        {/* Stânga */}
        <aside className="col-span-3">
          <div className="rounded-2xl bg-white p-6 shadow">
            <div className="mb-4 flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-xl font-bold text-white">
                O
              </div>

              <div>
                <h2 className="font-semibold">Ovidiu</h2>
                <p className="text-sm text-gray-500">
                  Vezi profilul
                </p>
              </div>
            </div>

            <nav className="space-y-3">
              <button className="block w-full rounded-lg p-3 text-left hover:bg-slate-100">
                👤 Profil
              </button>

              <button className="block w-full rounded-lg p-3 text-left hover:bg-slate-100">
                👥 Prieteni
              </button>

              <button className="block w-full rounded-lg p-3 text-left hover:bg-slate-100">
                💬 Mesaje
              </button>

              <button className="block w-full rounded-lg p-3 text-left hover:bg-slate-100">
                ⚙️ Setări
              </button>
            </nav>
          </div>
        </aside>

        {/* Centru */}
        <section className="col-span-6 space-y-6">

          <div className="rounded-2xl bg-white p-5 shadow">
            <input
              placeholder="La ce te gândești?"
              className="w-full rounded-xl border p-4 outline-none"
            />

            <div className="mt-4 flex justify-end">
              <button className="rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-500">
                Publică
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-bold">
              Fluxul de postări
            </h2>

            <p className="text-gray-500">
              Aici vor apărea postările prietenilor tăi.
            </p>
          </div>

        </section>

        {/* Dreapta */}
        <aside className="col-span-3">
          <div className="rounded-2xl bg-white p-6 shadow">
            <h2 className="mb-4 font-bold">
              🟢 Prieteni online
            </h2>

            <div className="space-y-3">
              <p>Alex</p>
              <p>Maria</p>
              <p>Andrei</p>
            </div>
          </div>
        </aside>

      </div>
    </main>
  );
}