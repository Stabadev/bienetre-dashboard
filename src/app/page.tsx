import Link from "next/link";
import { isAuthenticated } from "@/lib/auth";

export default async function Home() {
  const dashboardHref = (await isAuthenticated()) ? "/dashboard" : "/login";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="flex flex-col items-center gap-6 text-center">
      <h1 className="text-4xl font-semibold">
        Bien-être Dashboard MVP
      </h1>
        <Link
          className="rounded-lg bg-zinc-950 px-5 py-3 font-medium text-white transition hover:bg-zinc-800"
          href={dashboardHref}
        >
          Accéder au dashboard
        </Link>
      </section>
    </main>
  );
}
