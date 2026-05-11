import Image from "next/image";
import Link from "next/link";
import { ReservationForm } from "@/components/reservation/ReservationForm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function serializeAvailabilitySlot(slot: {
  id: string;
  startAt: Date;
  endAt: Date;
}) {
  return {
    id: slot.id,
    startAt: slot.startAt.toISOString(),
    endAt: slot.endAt.toISOString(),
  };
}

export default async function ReservationPage() {
  const now = new Date();
  const availabilitySlots = await db.availabilitySlot.findMany({
    where: {
      isActive: true,
      endAt: {
        gt: now,
      },
    },
    orderBy: {
      startAt: "asc",
    },
    select: {
      id: true,
      startAt: true,
      endAt: true,
    },
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
              Réservation DEV
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Demander un rendez-vous
            </h1>
            <p className="mt-2 max-w-2xl text-zinc-600">
              Choisissez une durée, une date et une heure dans une plage
              disponible. La demande sera enregistrée en attente de validation.
            </p>
          </div>

          <Link
            className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white/90 px-4 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-amber-300 hover:bg-white"
            href="/"
          >
            Retour accueil
          </Link>
        </header>

        <ReservationForm
          availabilitySlots={availabilitySlots.map(serializeAvailabilitySlot)}
        />
      </section>
    </main>
  );
}
