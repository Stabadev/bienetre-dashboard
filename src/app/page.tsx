import Link from "next/link";
import { isAuthenticated } from "@/lib/auth";

export default async function Home() {
  const dashboardHref = (await isAuthenticated()) ? "/dashboard" : "/login";
  const highlights = [
    "Les rendez-vous sont importés depuis un agenda Google Calendar existant.",
    "L'application ne crée, ne modifie et ne supprime aucun rendez-vous.",
    "Seuls les paiements sont enregistrés dans cet outil.",
    "L'export CSV est compatible Excel et LibreOffice.",
  ];

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#fff7ed_0%,#f8fafc_42%,#ecfdf5_100%)] px-6 py-10 text-zinc-950">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="rounded-3xl border border-white/70 bg-white/75 p-8 text-center shadow-sm backdrop-blur sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
            Administration
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Bien-être Dashboard
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600">
            Suivi des rendez-vous et paiements pour une activité bien-être,
            avec des rendez-vous lus depuis Google Calendar et des paiements
            gérés dans un espace admin.
          </p>

          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              className="inline-flex h-12 items-center justify-center rounded-xl bg-amber-600 px-6 font-semibold text-white shadow-sm transition hover:bg-amber-700"
              href={dashboardHref}
            >
              Accéder au dashboard
            </Link>
            <Link
              className="inline-flex h-12 items-center justify-center rounded-xl border border-zinc-200 bg-white px-6 font-semibold text-zinc-800 shadow-sm transition hover:border-amber-300"
              href="/help"
            >
              Voir l&apos;aide
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {highlights.map((highlight) => (
            <article
              className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm backdrop-blur"
              key={highlight}
            >
              <p className="text-zinc-700">{highlight}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
