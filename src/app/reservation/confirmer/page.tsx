import Link from "next/link";
import { BookingStatus } from "@prisma/client";
import { hashBookingConfirmationToken } from "@/lib/booking-confirmation";
import { db } from "@/lib/db";
import { formatDate, formatTime } from "@/components/dashboard/formatters";

export const dynamic = "force-dynamic";

type ConfirmationPageProps = {
  searchParams: Promise<{
    token?: string;
  }>;
};

type ConfirmationResult =
  | {
      ok: true;
      startAt: string;
      endAt: string;
      service: string | null;
    }
  | {
      ok: false;
      title: string;
      message: string;
    };

export default async function BookingConfirmationPage({
  searchParams,
}: ConfirmationPageProps) {
  const { token } = await searchParams;
  const result = await confirmBooking(token);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#fff7ed_0%,#f8fafc_48%,#ecfdf5_100%)] px-6 py-10 text-zinc-950">
      <section className="w-full max-w-xl rounded-2xl border border-white/70 bg-white/85 p-6 shadow-sm backdrop-blur sm:p-8">
        {result.ok ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Demande confirmée
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              Votre demande est confirmée
            </h1>
            <p className="mt-4 leading-7 text-zinc-700">
              Votre demande de rendez-vous
              {result.service ? ` pour ${result.service}` : ""} est confirmée
              pour le {formatDate(result.startAt)} de {formatTime(result.startAt)} à{" "}
              {formatTime(result.endAt)}.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold uppercase tracking-wide text-red-700">
              Confirmation impossible
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              {result.title}
            </h1>
            <p className="mt-4 leading-7 text-zinc-700">{result.message}</p>
          </>
        )}

        <Link
          className="mt-7 inline-flex h-11 w-full items-center justify-center rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700"
          href="/reservation"
        >
          Retour à la réservation
        </Link>
      </section>
    </main>
  );
}

async function confirmBooking(token: string | undefined): Promise<ConfirmationResult> {
  if (!token) {
    return {
      ok: false,
      title: "Lien invalide",
      message: "Le lien de confirmation ne contient pas de token valide.",
    };
  }

  const tokenHash = hashBookingConfirmationToken(token);
  const booking = await db.booking.findUnique({
    where: {
      confirmationTokenHash: tokenHash,
    },
  });

  if (!booking) {
    return {
      ok: false,
      title: "Lien introuvable",
      message: "Ce lien de confirmation est invalide ou a déjà été utilisé.",
    };
  }

  if (booking.status !== BookingStatus.PENDING) {
    return {
      ok: false,
      title: "Demande déjà traitée",
      message: "Cette demande de rendez-vous n'est plus en attente.",
    };
  }

  if (
    booking.confirmationTokenExpiresAt &&
    booking.confirmationTokenExpiresAt.getTime() < Date.now()
  ) {
    await db.booking.update({
      where: {
        id: booking.id,
      },
      data: {
        confirmationTokenHash: null,
        confirmationTokenExpiresAt: null,
        status: BookingStatus.EXPIRED,
      },
    });

    return {
      ok: false,
      title: "Lien expiré",
      message: "Ce lien de confirmation a expiré. Vous pouvez refaire une demande.",
    };
  }

  const confirmedBooking = await db.booking.update({
    where: {
      id: booking.id,
    },
    data: {
      confirmationTokenHash: null,
      confirmationTokenExpiresAt: null,
      confirmedAt: new Date(),
      status: BookingStatus.CONFIRMED,
    },
  });

  return {
    ok: true,
    endAt: confirmedBooking.endAt.toISOString(),
    service: confirmedBooking.service,
    startAt: confirmedBooking.startAt.toISOString(),
  };
}
