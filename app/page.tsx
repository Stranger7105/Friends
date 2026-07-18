export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-violet-50">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 text-2xl font-bold text-white shadow-lg">
              F
            </div>

            <span className="text-2xl font-bold text-slate-900">Friends</span>
          </div>

          <button className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-800 transition hover:bg-slate-50">
            Conectează-te
          </button>
        </header>

        <section className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-2">
          <div>
            <span className="inline-block rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
              O comunitate creată pentru oameni
            </span>

            <h1 className="mt-6 max-w-2xl text-5xl font-bold leading-tight text-slate-900 md:text-6xl">
              Conectează-te.
              <span className="block bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                Distribuie. Fii împreună.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              Friends este locul unde îți găsești prietenii, distribui momente
              importante și descoperi comunități care îți împărtășesc pasiunile.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <button className="rounded-xl bg-blue-600 px-7 py-4 font-semibold text-white shadow-lg transition hover:bg-blue-700">
                Creează cont
              </button>

              <button className="rounded-xl border border-slate-300 bg-white px-7 py-4 font-semibold text-slate-800 transition hover:bg-slate-50">
                Află mai multe
              </button>
            </div>

            <div className="mt-10 flex flex-wrap gap-6 text-sm text-slate-500">
              <span>✓ Cont gratuit</span>
              <span>✓ Confidențialitate clară</span>
              <span>✓ Design modern</span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-6 -top-6 h-32 w-32 rounded-full bg-blue-300 opacity-30 blur-3xl" />
            <div className="absolute -bottom-8 -right-6 h-40 w-40 rounded-full bg-violet-300 opacity-30 blur-3xl" />

            <div className="relative rounded-3xl border border-white bg-white/90 p-6 shadow-2xl backdrop-blur">
              <div className="flex items-center gap-4 border-b border-slate-100 pb-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-violet-500 font-bold text-white">
                  A
                </div>

                <div>
                  <p className="font-semibold text-slate-900">Ana Maria</p>
                  <p className="text-sm text-slate-500">Acum câteva minute</p>
                </div>
              </div>

              <p className="py-5 text-slate-700">
                O zi frumoasă alături de oamenii potriviți. 💙
              </p>

              <div className="flex h-64 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-200 via-violet-200 to-pink-200">
                <p className="text-xl font-semibold text-slate-700">
                  Primul moment distribuit pe Friends
                </p>
              </div>

              <div className="mt-5 flex items-center justify-between text-sm text-slate-500">
                <span>❤️ 128 aprecieri</span>
                <span>24 comentarii</span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4">
                <button className="rounded-lg py-2 font-medium text-slate-600 hover:bg-slate-50">
                  Îmi place
                </button>
                <button className="rounded-lg py-2 font-medium text-slate-600 hover:bg-slate-50">
                  Comentează
                </button>
                <button className="rounded-lg py-2 font-medium text-slate-600 hover:bg-slate-50">
                  Distribuie
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}