import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReservationForm } from "@/components/reservation/ReservationForm";
import { getReservationPageData } from "@/lib/reservation-page-data";
import { getReservationService } from "@/lib/reservation-services";

export const dynamic = "force-dynamic";

type ReservationServicePageProps = {
  params: Promise<{
    serviceType: string;
  }>;
};

export default async function ReservationServicePage({
  params,
}: ReservationServicePageProps) {
  const { serviceType } = await params;
  const service = getReservationService(serviceType);

  if (!service) {
    notFound();
  }

  const { availableTimes } = await getReservationPageData({
    durations: [service.durationMinutes],
  });

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#fff7ed_0%,#f8fafc_48%,#ecfdf5_100%)] px-4 py-6 text-zinc-950 sm:px-6 sm:py-10">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-8">
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
              Réservation · {service.shortLabel}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              {service.title}
            </h1>
            <p className="mt-2 max-w-2xl text-zinc-600">
              Choisissez un créneau, renseignez vos coordonnées, puis confirmez
              votre rendez-vous avec le lien reçu par email.
            </p>
          </div>

          <Link
            className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white/90 px-4 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-amber-300 hover:bg-white"
            href="/reservation"
          >
            Changer de parcours
          </Link>
        </header>

        <ReservationForm
          availableTimes={availableTimes}
          fixedDurationMinutes={service.durationMinutes}
          serviceDescription={service.description}
          serviceLabel={service.label}
        />
      </section>
    </main>
  );
}
