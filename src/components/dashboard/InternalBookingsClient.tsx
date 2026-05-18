"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatDate, formatTime } from "./formatters";

type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "EXPIRED";
type BookingSource = "INTERNAL" | "CALENDLY" | "ADMIN";

export type InternalBookingView = {
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
  startAt: string;
  endAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReservationAvailabilitySlotView = {
  id: string;
  startAt: string;
  endAt: string;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type InternalBookingsClientProps = {
  initialAvailabilitySlots: ReservationAvailabilitySlotView[];
  initialBookings: InternalBookingView[];
};

type WeekAvailabilitySlot = ReservationAvailabilitySlotView & {
  endStep: number;
  startStep: number;
};

type WeekBooking = InternalBookingView & {
  endStep: number;
  startStep: number;
};

type CalendlySyncResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{
    calendlyEventUri: string | null;
    message: string;
  }>;
};

const statusLabels: Record<BookingStatus, string> = {
  CANCELLED: "Annulé",
  CONFIRMED: "RDV confirmé",
  EXPIRED: "Expiré",
  PENDING: "En attente du clic client",
};

const sourceLabels: Record<BookingSource, string> = {
  ADMIN: "Admin",
  CALENDLY: "Calendly",
  INTERNAL: "Interne",
};

const weekDayIndexes = [1, 2, 3, 4, 5, 6];
const dayStartHour = 6;
const dayEndHour = 20;
const stepMinutes = 15;
const stepsPerHour = 60 / stepMinutes;
const totalSteps = (dayEndHour - dayStartHour) * stepsPerHour;
const rowHeightPx = 16;
const calendarGridTemplateColumns = "4.5rem repeat(6, minmax(8.5rem, 1fr))";
const calendarHeightPx = totalSteps * rowHeightPx;
const parisDateKeyFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Europe/Paris",
  year: "numeric",
});
const parisTimePartsFormatter = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

function startOfWeek(value: Date): Date {
  const date = new Date(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);

  return date;
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);

  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

function dateKey(date: Date): string {
  const parts = parisDateKeyFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function getWeekTitle(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 5);

  return `${formatDate(weekStart.toISOString())} - ${formatDate(
    weekEnd.toISOString(),
  )}`;
}

function getDayLabel(day: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    timeZone: "Europe/Paris",
    weekday: "short",
  }).format(day);
}

function getStepFromDate(value: string): number {
  const parts = parisTimePartsFormatter.formatToParts(new Date(value));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0,
  );
  const minutes = hour * 60 + minute;

  return Math.round((minutes - dayStartHour * 60) / stepMinutes);
}

function getGridLineClassName(step: number): string {
  if (step % stepsPerHour === 0) {
    return "border-t-2 border-zinc-400";
  }

  if (step % stepsPerHour === stepsPerHour / 2) {
    return "border-t border-zinc-300";
  }

  return "border-t border-zinc-200/70";
}

function getDurationMinutes(booking: InternalBookingView): number {
  return Math.round(
    (new Date(booking.endAt).getTime() - new Date(booking.startAt).getTime()) /
      60_000,
  );
}

function formatBookingDateTime(booking: InternalBookingView): string {
  return `${formatDate(booking.startAt)} · ${formatTime(
    booking.startAt,
  )} - ${formatTime(booking.endAt)}`;
}

function getStatusClassName(status: BookingStatus): string {
  if (status === "CONFIRMED") {
    return "bg-emerald-100 text-emerald-800";
  }

  if (status === "CANCELLED") {
    return "bg-red-100 text-red-800";
  }

  if (status === "EXPIRED") {
    return "bg-zinc-200 text-zinc-700";
  }

  return "bg-amber-100 text-amber-800";
}

function getBookingBlockClassName(booking: InternalBookingView): string {
  if (booking.status === "CANCELLED") {
    return "border-red-200 bg-red-50 text-red-950";
  }

  if (booking.status === "EXPIRED") {
    return "border-zinc-300 bg-zinc-100 text-zinc-800";
  }

  if (booking.source === "CALENDLY") {
    return "border-sky-500 bg-sky-200 text-sky-950";
  }

  if (booking.source === "INTERNAL") {
    return "border-rose-500 bg-rose-200 text-rose-950";
  }

  return "border-zinc-400 bg-zinc-200 text-zinc-950";
}

function getSourceClassName(source: BookingSource): string {
  if (source === "CALENDLY") {
    return "bg-sky-100 text-sky-800";
  }

  if (source === "ADMIN") {
    return "bg-zinc-200 text-zinc-800";
  }

  return "bg-rose-100 text-rose-800";
}

function SourceBadge({ source }: { source: BookingSource }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getSourceClassName(
        source,
      )}`}
    >
      {sourceLabels[source]}
    </span>
  );
}

async function readErrorMessage(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  return payload?.error ?? "La requête a échoué.";
}

export function InternalBookingsClient({
  initialAvailabilitySlots,
  initialBookings,
}: InternalBookingsClientProps) {
  const router = useRouter();
  const [availabilitySlots] = useState(initialAvailabilitySlots);
  const [bookings, setBookings] = useState(initialBookings);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selectedBookingId, setSelectedBookingId] = useState<string>();
  const [updatingBookingId, setUpdatingBookingId] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isSyncingCalendly, setIsSyncingCalendly] = useState(false);
  const [syncResult, setSyncResult] = useState<CalendlySyncResult>();
  const [syncErrorMessage, setSyncErrorMessage] = useState<string>();
  const weekDays = useMemo(
    () => weekDayIndexes.map((dayOffset) => addDays(weekStart, dayOffset - 1)),
    [weekStart],
  );
  const visibleBookings = useMemo(() => {
    const visibleKeys = new Set(weekDays.map(dateKey));

    return bookings.filter(
      (booking) =>
        (booking.status === "PENDING" || booking.status === "CONFIRMED") &&
        visibleKeys.has(dateKey(new Date(booking.startAt))),
    );
  }, [bookings, weekDays]);
  const visibleAvailabilitySlots = useMemo(() => {
    const visibleKeys = new Set(weekDays.map(dateKey));

    return availabilitySlots.filter(
      (slot) =>
        slot.isActive && visibleKeys.has(dateKey(new Date(slot.startAt))),
    );
  }, [availabilitySlots, weekDays]);
  const historyBookings = useMemo(
    () =>
      bookings.filter(
        (booking) =>
          booking.status === "CANCELLED" || booking.status === "EXPIRED",
      ),
    [bookings],
  );
  const selectedBooking = useMemo(
    () => bookings.find((booking) => booking.id === selectedBookingId),
    [bookings, selectedBookingId],
  );
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
      setSelectedBookingId(updatedBooking.id);
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

  async function reloadBookings() {
    const response = await fetch("/api/bookings");

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const refreshedBookings = (await response.json()) as InternalBookingView[];

    setBookings(refreshedBookings);
  }

  async function syncCalendly() {
    setIsSyncingCalendly(true);
    setSyncErrorMessage(undefined);
    setSyncResult(undefined);

    try {
      const response = await fetch("/api/admin/calendly/sync", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const result = (await response.json()) as CalendlySyncResult;

      setSyncResult(result);
      await reloadBookings();
      router.refresh();
    } catch (error) {
      setSyncErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de synchroniser Calendly.",
      );
    } finally {
      setIsSyncingCalendly(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-white/70 bg-white/85 px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-9 items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-800">
              {totals.CONFIRMED} confirmés
            </span>
            <span className="inline-flex h-9 items-center rounded-full border border-amber-200 bg-amber-50 px-3 text-sm font-semibold text-amber-800">
              {totals.PENDING} en attente
            </span>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <span className="text-xs text-zinc-500">
              Sync manuelle Calendly
            </span>
            <button
              className="inline-flex h-9 items-center justify-center rounded-xl bg-zinc-950 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
              disabled={isSyncingCalendly}
              onClick={syncCalendly}
              title="Importe les rendez-vous Calendly actifs dans l'agenda interne."
              type="button"
            >
              {isSyncingCalendly ? "Synchronisation..." : "Synchroniser Calendly"}
            </button>
          </div>
        </div>

        {syncResult || syncErrorMessage ? (
          <div className="mt-3">
            {syncResult ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <p className="font-semibold">
                  Sync Calendly : {syncResult.created} créés ·{" "}
                  {syncResult.updated} mis à jour · {syncResult.skipped} ignorés
                </p>
                {syncResult.errors.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {syncResult.errors.map((syncError, index) => (
                      <li
                        key={`${syncError.calendlyEventUri ?? "event"}-${index}`}
                      >
                        {syncError.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {syncErrorMessage ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {syncErrorMessage}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      {errorMessage ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <section className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Agenda de la semaine</h2>
            <p className="mt-1 text-sm text-zinc-600">
              {getWeekTitle(weekStart)}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-amber-300"
              onClick={() => setWeekStart((current) => addWeeks(current, -1))}
              type="button"
            >
              Semaine précédente
            </button>
            <button
              className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-amber-300"
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              type="button"
            >
              Aujourd&apos;hui
            </button>
            <button
              className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-amber-300"
              onClick={() => setWeekStart((current) => addWeeks(current, 1))}
              type="button"
            >
              Semaine suivante
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[960px] overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <div
              className="grid"
              style={{ gridTemplateColumns: calendarGridTemplateColumns }}
            >
              <div className="border-b border-zinc-200 bg-zinc-50" />
              {weekDays.map((day) => (
                <div
                  className="border-b border-l border-zinc-200 bg-zinc-50 px-3 py-2 text-center text-sm font-semibold text-zinc-800"
                  key={dateKey(day)}
                >
                  {getDayLabel(day)}
                </div>
              ))}
            </div>

            <div
              className="grid"
              style={{ gridTemplateColumns: calendarGridTemplateColumns }}
            >
              <div
                className="border-r border-zinc-200 bg-zinc-50"
                style={{ height: calendarHeightPx }}
              >
                {Array.from({ length: totalSteps }).map((_, step) => (
                  <div
                    className={`pr-2 text-right text-xs ${getGridLineClassName(
                      step,
                    )} ${
                      step % stepsPerHour === 0
                        ? "pt-0.5 font-semibold text-zinc-700"
                        : "text-zinc-400"
                    }`}
                    key={step}
                    style={{ height: rowHeightPx }}
                  >
                    {step % stepsPerHour === 0
                      ? `${String(dayStartHour + step / stepsPerHour).padStart(
                          2,
                          "0",
                        )}:00`
                      : ""}
                  </div>
                ))}
              </div>

              {weekDays.map((day) => (
                <BookingDayColumn
                  availabilitySlots={visibleAvailabilitySlots.filter(
                    (slot) => dateKey(new Date(slot.startAt)) === dateKey(day),
                  )}
                  bookings={visibleBookings.filter(
                    (booking) =>
                      dateKey(new Date(booking.startAt)) === dateKey(day),
                  )}
                  key={dateKey(day)}
                  onSelect={setSelectedBookingId}
                  selectedBookingId={selectedBookingId}
                />
              ))}
            </div>
          </div>
        </div>

        {visibleBookings.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600">
            Aucun rendez-vous confirmé ou en attente cette semaine.
          </p>
        ) : (
          <p className="mt-4 text-sm text-zinc-600">
            Les réservations annulées ne sont pas affichées dans l&apos;agenda.
            Les zones vertes pâles indiquent les disponibilités ouvertes. Cliquez
            sur un rendez-vous pour afficher le détail.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm">
        <h2 className="text-xl font-semibold">
          Réservations annulées / historique
        </h2>
        {historyBookings.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">
            Aucune réservation annulée ou expirée.
          </p>
        ) : (
          <div className="mt-4 divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
            {historyBookings.map((booking) => (
              <button
                className="grid w-full gap-2 px-4 py-3 text-left text-sm transition hover:bg-zinc-50 sm:grid-cols-[1.4fr_1fr_1fr_auto]"
                key={booking.id}
                onClick={() => setSelectedBookingId(booking.id)}
                type="button"
              >
                <span className="font-medium text-zinc-950">
                  {booking.clientName}
                </span>
                <span className="text-zinc-600">
                  {formatBookingDateTime(booking)}
                </span>
                <span className="text-zinc-600">
                  {statusLabels[booking.status]}
                </span>
                <span className="text-zinc-600">
                  {sourceLabels[booking.source]}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedBooking ? (
        <BookingDetailModal
          booking={selectedBooking}
          isUpdating={updatingBookingId === selectedBooking.id}
          onCancel={() =>
            updateBookingStatus(selectedBooking.id, "CANCELLED")
          }
          onClose={() => setSelectedBookingId(undefined)}
          onConfirm={() =>
            updateBookingStatus(selectedBooking.id, "CONFIRMED")
          }
        />
      ) : null}
    </div>
  );
}

function BookingDayColumn({
  availabilitySlots,
  bookings,
  onSelect,
  selectedBookingId,
}: {
  availabilitySlots: ReservationAvailabilitySlotView[];
  bookings: InternalBookingView[];
  onSelect: (bookingId: string) => void;
  selectedBookingId?: string;
}) {
  const positionedAvailabilitySlots: WeekAvailabilitySlot[] = availabilitySlots
    .map((slot) => ({
      ...slot,
      endStep: Math.min(totalSteps, getStepFromDate(slot.endAt)),
      startStep: Math.max(0, getStepFromDate(slot.startAt)),
    }))
    .filter((slot) => slot.endStep > 0 && slot.startStep < totalSteps);
  const positionedBookings: WeekBooking[] = bookings
    .map((booking) => ({
      ...booking,
      endStep: Math.min(totalSteps, getStepFromDate(booking.endAt)),
      startStep: Math.max(0, getStepFromDate(booking.startAt)),
    }))
    .filter((booking) => booking.endStep > 0 && booking.startStep < totalSteps);

  return (
    <div
      className="relative border-l border-zinc-200"
      style={{
        backgroundColor: "rgba(250, 250, 250, 0.9)",
        backgroundImage:
          "repeating-linear-gradient(45deg, rgba(113,113,122,0.08) 0, rgba(113,113,122,0.08) 1px, transparent 1px, transparent 8px)",
        height: calendarHeightPx,
      }}
    >
      {Array.from({ length: totalSteps }).map((_, step) => (
        <div
          className={getGridLineClassName(step)}
          key={step}
          style={{ height: rowHeightPx }}
        />
      ))}

      {positionedAvailabilitySlots.map((slot) => {
        const height = Math.max(
          rowHeightPx,
          (slot.endStep - slot.startStep) * rowHeightPx,
        );

        return (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1 right-1 rounded-md border-y-2 border-l-4 border-r border-y-emerald-300/80 border-l-emerald-500/80 border-r-emerald-100 bg-emerald-50/60"
            key={slot.id}
            style={{
              height,
              top: slot.startStep * rowHeightPx,
            }}
          />
        );
      })}

      {positionedBookings.map((booking) => {
        const height = Math.max(
          rowHeightPx,
          (booking.endStep - booking.startStep) * rowHeightPx,
        );

        return (
          <article
            className={`absolute left-1 right-1 z-10 overflow-hidden rounded-lg border px-2 py-1 text-left text-xs shadow-sm transition hover:brightness-95 ${
              selectedBookingId === booking.id ? "ring-2 ring-zinc-900" : ""
            } ${getBookingBlockClassName(booking)}`}
            key={booking.id}
            onClick={() => onSelect(booking.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(booking.id);
              }
            }}
            role="button"
            style={{
              height,
              top: booking.startStep * rowHeightPx,
            }}
            tabIndex={0}
          >
            <span className="block font-semibold leading-tight">
              {formatTime(booking.startAt)} - {formatTime(booking.endAt)}
            </span>
            <span className="mt-0.5 block truncate font-semibold">
              {booking.clientName}
            </span>
            <span className="mt-0.5 block truncate opacity-80">
              {statusLabels[booking.status]}
            </span>
            <span className="block truncate opacity-80">
              {booking.service ?? `${getDurationMinutes(booking)} min`}
            </span>
          </article>
        );
      })}
    </div>
  );
}

function BookingDetailPanel({
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
  const isCalendlyBooking = booking.source === "CALENDLY";
  const canConfirm = booking.status === "PENDING" && !isCalendlyBooking;
  const canCancel =
    (booking.status === "PENDING" || booking.status === "CONFIRMED") &&
    !isCalendlyBooking;

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClassName(
                booking.status,
              )}`}
            >
              {statusLabels[booking.status]}
            </span>
            <SourceBadge source={booking.source} />
          </div>

          <h2 className="mt-3 text-xl font-semibold text-zinc-950">
            {booking.clientName}
          </h2>
          <p className="mt-1 font-medium text-zinc-700">
            {formatBookingDateTime(booking)}
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            {booking.service ?? `${getDurationMinutes(booking)} min`}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
          {canConfirm ? (
            <button
              className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
              disabled={isUpdating}
              onClick={onConfirm}
              type="button"
            >
              {isUpdating ? "Mise à jour..." : "Confirmer manuellement"}
            </button>
          ) : null}
          {canCancel ? (
            <button
              className="inline-flex h-10 items-center justify-center rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-300"
              disabled={isUpdating}
              onClick={onCancel}
              type="button"
            >
              Marquer comme annulé
            </button>
          ) : null}
        </div>
      </div>

      {isCalendlyBooking ? (
        <p className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
          Géré dans Calendly. Les actions de confirmation et d&apos;annulation
          sont désactivées ici.
        </p>
      ) : null}

      {booking.status === "PENDING" && !isCalendlyBooking ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          À utiliser seulement si le client a confirmé par téléphone ou
          message.
        </p>
      ) : null}

      {canCancel ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Attention : aucun email automatique n&apos;est envoyé au client pour
          l&apos;instant. Pensez à le prévenir manuellement.
        </p>
      ) : null}

      {booking.status === "CANCELLED" ? (
        <p className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700">
          Réservation annulée.
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <InfoBlock label="Nom / prénom" value={booking.clientName} />
        <InfoBlock label="Téléphone" value={booking.clientPhone ?? ""} />
        <InfoBlock label="Email" value={booking.clientEmail} />
        <InfoBlock label="Source" value={sourceLabels[booking.source]} />
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

function BookingDetailModal({
  booking,
  isUpdating,
  onCancel,
  onClose,
  onConfirm,
}: {
  booking: InternalBookingView;
  isUpdating: boolean;
  onCancel: () => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4 py-6"
      role="dialog"
    >
      <section className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
              Rendez-vous
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-zinc-950">
              Détail du rendez-vous
            </h2>
          </div>
          <button
            className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
            onClick={onClose}
            type="button"
          >
            Fermer
          </button>
        </div>

        <div className="mt-5">
          <BookingDetailPanel
            booking={booking}
            isUpdating={isUpdating}
            onCancel={onCancel}
            onConfirm={onConfirm}
          />
        </div>
      </section>
    </div>
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
