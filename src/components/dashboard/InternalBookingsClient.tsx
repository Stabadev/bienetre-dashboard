"use client";

import { useMemo, useState } from "react";
import { formatDate, formatTime } from "./formatters";

type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "EXPIRED";

export type InternalBookingView = {
  id: string;
  source: string;
  status: BookingStatus;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  clientMessage: string | null;
  service: string | null;
  startAt: string;
  endAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type InternalBookingsClientProps = {
  initialBookings: InternalBookingView[];
};

const statusLabels: Record<BookingStatus, string> = {
  CANCELLED: "Annulée",
  CONFIRMED: "Confirmée",
  EXPIRED: "Expirée",
  PENDING: "En attente",
};

function getDurationMinutes(booking: InternalBookingView): number {
  return Math.round(
    (new Date(booking.endAt).getTime() - new Date(booking.startAt).getTime()) /
      60_000,
  );
}

function formatCreatedAt(value: string): string {
  return `${formatDate(value)} à ${formatTime(value)}`;
}

async function readErrorMessage(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  return payload?.error ?? "La requête a échoué.";
}

export function InternalBookingsClient({
  initialBookings,
}: InternalBookingsClientProps) {
  const [bookings, setBookings] = useState(initialBookings);
  const [updatingBookingId, setUpdatingBookingId] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const totals = useMemo(
    () =>
      bookings.reduce(
        (counts, booking) => ({
          ...counts,
          [booking.status]: counts[booking.status] + 1,
        }),
        {
          CANCELLED: 0,
          CONFIRMED: 0,
          EXPIRED: 0,
          PENDING: 0,
        } satisfies Record<BookingStatus, number>,
      ),
    [bookings],
  );

  async function updateBookingStatus(
    bookingId: string,
    status: "CONFIRMED" | "CANCELLED",
  ) {
    setUpdatingBookingId(bookingId);
    setErrorMessage(undefined);

    try {
      const response = await fetch(
        `/api/bookings/${encodeURIComponent(bookingId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        },
      );

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const updatedBooking = (await response.json()) as InternalBookingView;

      setBookings((currentBookings) =>
        currentBookings.map((booking) =>
          booking.id === updatedBooking.id ? updatedBooking : booking,
        ),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de modifier la réservation.",
      );
    } finally {
      setUpdatingBookingId(undefined);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(statusLabels) as BookingStatus[]).map((status) => (
          <article
            className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm"
            key={status}
          >
            <p className="text-sm font-medium text-zinc-500">
              {statusLabels[status]}
            </p>
            <p className="mt-2 text-3xl font-semibold text-zinc-950">
              {totals[status]}
            </p>
          </article>
        ))}
      </section>

      {errorMessage ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      {bookings.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-zinc-300 bg-white/80 p-6 text-sm text-zinc-600">
          Aucune réservation interne pour le moment.
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          {bookings.map((booking) => (
            <BookingCard
              booking={booking}
              isUpdating={updatingBookingId === booking.id}
              key={booking.id}
              onCancel={() => updateBookingStatus(booking.id, "CANCELLED")}
              onConfirm={() => updateBookingStatus(booking.id, "CONFIRMED")}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function BookingCard({
  booking,
  isUpdating,
  onCancel,
  onConfirm,
}: {
  booking: InternalBookingView;
  isUpdating: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const canConfirm = booking.status !== "CONFIRMED";
  const canCancel = booking.status !== "CANCELLED";

  return (
    <article className="rounded-2xl border border-white/70 bg-white/85 p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                booking.status === "CONFIRMED"
                  ? "bg-emerald-100 text-emerald-800"
                  : booking.status === "CANCELLED"
                    ? "bg-red-100 text-red-800"
                    : booking.status === "EXPIRED"
                      ? "bg-zinc-200 text-zinc-700"
                      : "bg-amber-100 text-amber-800"
              }`}
            >
              {statusLabels[booking.status]}
            </span>
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
              {booking.source}
            </span>
          </div>

          <h2 className="mt-3 text-xl font-semibold text-zinc-950">
            {formatDate(booking.startAt)}
          </h2>
          <p className="mt-1 font-medium text-zinc-700">
            {formatTime(booking.startAt)} - {formatTime(booking.endAt)} ·{" "}
            {getDurationMinutes(booking)} min
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            {booking.service ?? "Prestation non précisée"}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
          <button
            className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
            disabled={!canConfirm || isUpdating}
            onClick={onConfirm}
            type="button"
          >
            {isUpdating ? "Mise à jour..." : "Confirmer"}
          </button>
          <button
            className="inline-flex h-10 items-center justify-center rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-300"
            disabled={!canCancel || isUpdating}
            onClick={onCancel}
            type="button"
          >
            Annuler
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <InfoBlock label="Client" value={booking.clientName} />
        <InfoBlock label="Email" value={booking.clientEmail} />
        <InfoBlock label="Téléphone" value={booking.clientPhone ?? ""} />
        <InfoBlock label="Créée le" value={formatCreatedAt(booking.createdAt)} />
      </div>

      {booking.clientMessage ? (
        <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          <p className="font-semibold text-zinc-950">Message client</p>
          <p className="mt-2 whitespace-pre-wrap leading-6">
            {booking.clientMessage}
          </p>
        </div>
      ) : null}
    </article>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-1 truncate font-medium text-zinc-900">
        {value || "Non renseigné"}
      </p>
    </div>
  );
}
