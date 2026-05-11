import Link from "next/link";
import { redirect } from "next/navigation";
import type { BookingSource, BookingStatus } from "@prisma/client";
import { LogoutButton } from "@/components/auth/LogoutButton";
import {
  InternalBookingsClient,
  type InternalBookingView,
} from "@/components/dashboard/InternalBookingsClient";
import { isAuthenticated } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function serializeBooking(booking: {
  id: string;
  source: BookingSource;
  status: BookingStatus;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  clientMessage: string | null;
  service: string | null;
  startAt: Date;
  endAt: Date;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): InternalBookingView {
  return {
    ...booking,
    startAt: booking.startAt.toISOString(),
    endAt: booking.endAt.toISOString(),
    confirmedAt: booking.confirmedAt?.toISOString() ?? null,
    cancelledAt: booking.cancelledAt?.toISOString() ?? null,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  };
}

export default async function InternalBookingsPage() {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  const bookings = await db.booking.findMany({
    orderBy: {
      startAt: "asc",
    },
  });

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#fff7ed_0%,#f8fafc_42%,#ecfdf5_100%)] px-4 py-6 text-zinc-950 sm:px-6 sm:py-10">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
              Administration
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Réservations internes
            </h1>
            <p className="mt-2 text-zinc-600">
              Demandes issues de la réservation publique DEV.
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

        <InternalBookingsClient initialBookings={bookings.map(serializeBooking)} />
      </section>
    </main>
  );
}
