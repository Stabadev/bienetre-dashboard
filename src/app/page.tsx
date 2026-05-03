import Link from "next/link";
import { isAuthenticated } from "@/lib/auth";

export default async function Home() {
  const dashboardHref = (await isAuthenticated()) ? "/dashboard" : "/login";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#fff7ed_0%,#f8fafc_42%,#ecfdf5_100%)] px-6 py-10 text-zinc-950">
      <section className="flex w-full max-w-2xl flex-col items-center gap-7 rounded-3xl border border-white/70 bg-white/75 p-8 text-center shadow-sm backdrop-blur sm:p-10">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
            Administration
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Bien-être Dashboard
          </h1>
          <p className="text-lg text-zinc-600">
            Suivi des rendez-vous et paiements
          </p>
        </div>
        <Link
          className="inline-flex h-12 items-center justify-center rounded-xl bg-amber-600 px-6 font-semibold text-white shadow-sm transition hover:bg-amber-700"
          href={dashboardHref}
        >
          Accéder au dashboard
        </Link>
      </section>
    </main>
  );
}
