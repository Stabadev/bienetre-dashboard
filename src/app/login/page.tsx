import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage() {
  if (await isAuthenticated()) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#fff7ed_0%,#f8fafc_42%,#ecfdf5_100%)] px-6 py-10 text-zinc-950">
      <section className="w-full max-w-md rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur sm:p-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
            Bien-être Dashboard
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            Connexion admin
          </h1>
          <p className="mt-2 text-zinc-600">
            Accédez au suivi des rendez-vous et paiements.
          </p>
        </div>

        <LoginForm />

        <Link
          className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl border border-zinc-200 bg-white/90 px-4 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-amber-300 hover:bg-white"
          href="/"
        >
          Retour à l&apos;accueil
        </Link>
      </section>
    </main>
  );
}
