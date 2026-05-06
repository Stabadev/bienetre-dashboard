import Image from "next/image";
import Link from "next/link";
import { isAuthenticated } from "@/lib/auth";

export default async function Home() {
  const isLoggedIn = await isAuthenticated();
  const dashboardHref = isLoggedIn ? "/dashboard" : "/login";

  return (
    <main className="flex min-h-screen flex-col bg-[linear-gradient(135deg,#fff7ed_0%,#f8fafc_48%,#ecfdf5_100%)] px-6 py-8 text-zinc-950">
      <section className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center text-center">
        <div className="flex w-full flex-col items-center rounded-3xl border border-white/70 bg-white/70 px-7 py-9 shadow-sm backdrop-blur sm:px-10 sm:py-11">
          <Image
            alt="Bien Être des Sagesses"
            className="h-auto w-48"
            height={869}
            priority
            src="/invoices/logoBEDS.png"
            width={1392}
          />

          <h1 className="mt-7 text-sm font-medium uppercase tracking-wide text-zinc-500">
            Espace administration
          </h1>

          <Link
            className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-xl bg-amber-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-800"
            href={dashboardHref}
          >
            {isLoggedIn ? "Accéder au dashboard" : "Se connecter"}
          </Link>
        </div>
      </section>

      <footer className="pt-6 text-center text-xs text-zinc-400">
        <a
          className="transition hover:text-zinc-600"
          href="https://alexandre.rogues.fr"
          rel="noreferrer"
          target="_blank"
        >
          Andraion
        </a>
      </footer>
    </main>
  );
}
