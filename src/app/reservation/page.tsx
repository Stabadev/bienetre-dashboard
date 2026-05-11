import Image from "next/image";
import Link from "next/link";
import { reservationServices } from "@/lib/reservation-services";

export default function ReservationChoicePage() {
  const services = Object.values(reservationServices);

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#fff7ed_0%,#f8fafc_48%,#ecfdf5_100%)] px-4 py-6 text-zinc-950 sm:px-6 sm:py-10">
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Image
              alt="Bien Être des Sagesses"
              className="h-auto w-40"
              height={869}
              priority
              src="/invoices/logoBEDS.png"
              width={1392}
            />
            <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-amber-700">
              Réservation DEV
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Choisir un parcours
            </h1>
            <p className="mt-2 max-w-2xl text-zinc-600">
              Sélectionnez le type de rendez-vous souhaité. La durée sera
              appliquée automatiquement.
            </p>
          </div>

          <Link
            className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white/90 px-4 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-amber-300 hover:bg-white"
            href="/"
          >
            Retour accueil
          </Link>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {services.map((service) => (
            <Link
              className="rounded-2xl border border-white/70 bg-white/85 p-6 shadow-sm transition hover:border-amber-300 hover:bg-white"
              href={service.path}
              key={service.path}
            >
              <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
                {service.shortLabel}
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                {service.label}
              </h2>
              <p className="mt-3 leading-7 text-zinc-600">
                {service.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
