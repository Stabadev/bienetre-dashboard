import Link from "next/link";
import { isAuthenticated } from "@/lib/auth";

const helpSections = [
  {
    title: "À quoi sert cet outil ?",
    content:
      "Il sert à suivre les rendez-vous et les paiements associés. L'objectif est de voir rapidement ce qui est payé, ce qui reste à renseigner, et de pouvoir exporter les paiements.",
  },
  {
    title: "D'où viennent les rendez-vous ?",
    content:
      "Les rendez-vous viennent d'un agenda Google Calendar existant, lu via un lien iCal privé. L'application lit l'agenda, mais ne modifie jamais Google Calendar.",
  },
  {
    title: "Que se passe-t-il quand j'enregistre un paiement ?",
    content:
      "Le paiement est sauvegardé dans la base de l'application. Le rendez-vous Google Calendar reste inchangé.",
  },
  {
    title: "Puis-je modifier un paiement ?",
    content:
      "Oui. Il suffit de rouvrir le rendez-vous depuis le dashboard, de modifier les informations de paiement, puis d'enregistrer à nouveau.",
  },
  {
    title: "Puis-je supprimer un paiement ?",
    content:
      "Oui. La suppression efface uniquement le paiement enregistré dans l'application. Le rendez-vous Google Calendar n'est jamais supprimé.",
  },
  {
    title: "Comment fonctionne l'export CSV ?",
    content:
      "L'export reprend les paiements enregistrés dans l'application et génère un fichier CSV compatible avec Excel et LibreOffice.",
  },
  {
    title: "Confidentialité",
    content:
      "L'URL iCal reste côté serveur et n'est pas affichée dans le navigateur. L'accès au dashboard est protégé par une connexion admin.",
  },
  {
    title: "Limites de cette version",
    content:
      "Cette version ne permet pas de créer un rendez-vous, de modifier Google Calendar, de gérer un paiement en ligne ou de maintenir une fiche client complète.",
  },
];

export default async function HelpPage() {
  const dashboardHref = (await isAuthenticated()) ? "/dashboard" : "/login";

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#fff7ed_0%,#f8fafc_42%,#ecfdf5_100%)] px-6 py-10 text-zinc-950">
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <header className="rounded-3xl border border-white/70 bg-white/75 p-8 shadow-sm backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
            Bien-être Dashboard
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Aide & fonctionnement
          </h1>
          <p className="mt-3 max-w-2xl text-zinc-600">
            Une présentation simple de ce que l&apos;application fait, de ce
            qu&apos;elle ne fait pas, et de la manière d&apos;utiliser les
            paiements.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-amber-300"
              href="/"
            >
              Retour accueil
            </Link>
            <Link
              className="inline-flex h-11 items-center justify-center rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700"
              href={dashboardHref}
            >
              Accéder au dashboard
            </Link>
          </div>
        </header>

        <div className="grid gap-4">
          {helpSections.map((section) => (
            <article
              className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur"
              key={section.title}
            >
              <h2 className="text-xl font-semibold">{section.title}</h2>
              <p className="mt-2 leading-7 text-zinc-600">{section.content}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
