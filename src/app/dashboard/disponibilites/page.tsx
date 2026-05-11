import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { AvailabilitySlotsClient } from "@/components/dashboard/AvailabilitySlotsClient";
import { isAuthenticated } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function serializeAvailabilitySlot(slot: {
  id: string;
  startAt: Date;
  endAt: Date;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...slot,
    startAt: slot.startAt.toISOString(),
    endAt: slot.endAt.toISOString(),
    createdAt: slot.createdAt.toISOString(),
    updatedAt: slot.updatedAt.toISOString(),
  };
}

export default async function AvailabilitySlotsPage() {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  const slots = await db.availabilitySlot.findMany({
    orderBy: {
      startAt: "asc",
    },
  });

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#fff7ed_0%,#f8fafc_42%,#ecfdf5_100%)] px-4 py-6 text-zinc-950 sm:px-6 sm:py-10">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
              Administration
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Disponibilités
            </h1>
            <p className="mt-2 text-zinc-600">
              Plages ouvertes pour la future réservation interne.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white/90 px-4 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-amber-300 hover:bg-white"
              href="/dashboard"
            >
              Retour dashboard
            </Link>
            <LogoutButton />
          </div>
        </header>

        <AvailabilitySlotsClient initialSlots={slots.map(serializeAvailabilitySlot)} />
      </section>
    </main>
  );
}
