"use client";

import { FormEvent, useMemo, useState } from "react";
import { formatDate, formatTime } from "@/components/dashboard/formatters";
import {
  buildDisplayReservationCalendar,
  getNextMonthWithAvailability,
  getParisMonthKey,
  type DisplayReservationDay,
  type DisplayReservationTime,
} from "@/lib/reservation-display-slots";

type ReservationFormProps = {
  availableTimes: AvailableReservationTimeView[];
  fixedDurationMinutes?: 60 | 90;
  serviceDescription?: string;
  serviceLabel?: string;
};

type AvailableReservationTimeView = DisplayReservationTime;

type BookingResponse = {
  id: string;
  startAt: string;
  endAt: string;
  service: string | null;
  status: string;
};

const monthFormatter = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  timeZone: "Europe/Paris",
  year: "numeric",
});
const dayFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "long",
  timeZone: "Europe/Paris",
  weekday: "long",
});

function dateFromDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00`);
}

function dateFromMonthKey(monthKey: string): Date {
  return new Date(`${monthKey}-01T12:00:00`);
}

function getMonthLabel(monthKey: string): string {
  return monthFormatter.format(dateFromMonthKey(monthKey));
}

function getDayLabel(dateKey: string): string {
  return dayFormatter.format(dateFromDateKey(dateKey));
}

function addMonths(monthKey: string, offset: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1, 12, 0, 0));

  return date.toISOString().slice(0, 7);
}

async function readErrorMessage(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  return payload?.error ?? "La demande de réservation a échoué.";
}

function overlapsBooking({
  booking,
  availableTime,
}: {
  booking: BookingResponse;
  availableTime: AvailableReservationTimeView;
}): boolean {
  return new Date(availableTime.startAt).getTime() <
    new Date(booking.endAt).getTime() &&
    new Date(availableTime.endAt).getTime() >
      new Date(booking.startAt).getTime();
}

export function ReservationForm({
  availableTimes: initialAvailableTimes,
  fixedDurationMinutes,
  serviceDescription,
  serviceLabel,
}: ReservationFormProps) {
  const [availableTimes, setAvailableTimes] = useState(initialAvailableTimes);
  const [selectedDurationMinutes] = useState<60 | 90>(
    fixedDurationMinutes ?? 60,
  );
  const durationMinutes = fixedDurationMinutes ?? selectedDurationMinutes;
  const currentMonthKey = useMemo(() => getParisMonthKey(new Date()), []);
  const [selectedMonthKey, setSelectedMonthKey] = useState(currentMonthKey);
  const [hasSelectedMonthManually, setHasSelectedMonthManually] =
    useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState("");
  const [selectedStartAt, setSelectedStartAt] = useState("");
  const [clientFirstName, setClientFirstName] = useState("");
  const [clientLastName, setClientLastName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientMessage, setClientMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [createdBooking, setCreatedBooking] = useState<BookingResponse>();

  const filteredAvailableTimes = useMemo(
    () =>
      availableTimes.filter(
        (availableTime) => availableTime.durationMinutes === durationMinutes,
      ),
    [availableTimes, durationMinutes],
  );
  const displayCalendar = useMemo(
    () => buildDisplayReservationCalendar(filteredAvailableTimes),
    [filteredAvailableTimes],
  );
  const effectiveMonthKey = hasSelectedMonthManually
    ? selectedMonthKey
    : getNextMonthWithAvailability(displayCalendar, currentMonthKey);
  const visibleMonth =
    displayCalendar.monthsByKey[effectiveMonthKey] ?? null;
  const visibleDays = visibleMonth?.days ?? [];
  const selectedDay = visibleDays.find(
    (day) => day.dateKey === selectedDateKey,
  );
  const selectedDayTimes = selectedDay?.times ?? [];
  const selectedTime = selectedDayTimes.find(
    (time) => time.startAt === selectedStartAt,
  );

  function selectMonth(monthKey: string) {
    setHasSelectedMonthManually(true);
    setSelectedMonthKey(monthKey);
    setSelectedDateKey("");
    setSelectedStartAt("");
    setCreatedBooking(undefined);
    setErrorMessage(undefined);
  }

  async function submitReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedStartAt) {
      setErrorMessage("Choisissez un horaire.");
      setCreatedBooking(undefined);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(undefined);
    setCreatedBooking(undefined);

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startAt: selectedStartAt,
          durationMinutes,
          clientFirstName,
          clientLastName,
          clientEmail,
          clientPhone,
          clientMessage,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const booking = (await response.json()) as BookingResponse;

      setCreatedBooking(booking);
      setAvailableTimes((currentTimes) =>
        currentTimes.filter(
          (availableTime) => !overlapsBooking({ availableTime, booking }),
        ),
      );
      setSelectedDateKey("");
      setSelectedStartAt("");
      setClientFirstName("");
      setClientLastName("");
      setClientEmail("");
      setClientPhone("");
      setClientMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible d'enregistrer la demande.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (createdBooking) {
    return (
      <ConfirmationSuccess
        booking={createdBooking}
        durationMinutes={durationMinutes}
        serviceLabel={serviceLabel}
      />
    );
  }

  return (
    <form
      className="mx-auto grid w-full max-w-3xl gap-4 rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm sm:p-6"
      onSubmit={submitReservation}
    >
      <section className="rounded-xl border border-amber-100 bg-amber-50/70 p-4">
        <p className="text-sm font-semibold text-amber-950">
          {serviceLabel ?? "Séance"} · {durationMinutes === 90 ? "1h30" : "1h"}
        </p>
        {serviceDescription ? (
          <p className="mt-2 text-sm leading-6 text-zinc-700">
            {serviceDescription}
          </p>
        ) : null}
      </section>

      {displayCalendar.months.length === 0 ? (
        <EmptyState message="Aucun créneau n'est proposé pour le moment." />
      ) : (
        <>
          <section>
            <SectionTitle eyebrow="1" title="Choisissez un mois" />
            <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white p-2">
              <button
                className="h-11 rounded-lg border border-zinc-200 px-4 text-lg font-semibold text-zinc-800 transition hover:border-amber-300 hover:bg-amber-50"
                onClick={() => selectMonth(addMonths(effectiveMonthKey, -1))}
                type="button"
              >
                ‹
              </button>
              <p className="text-center text-base font-semibold capitalize text-zinc-950">
                {getMonthLabel(effectiveMonthKey)}
              </p>
              <button
                className="h-11 rounded-lg border border-zinc-200 px-4 text-lg font-semibold text-zinc-800 transition hover:border-amber-300 hover:bg-amber-50"
                onClick={() => selectMonth(addMonths(effectiveMonthKey, 1))}
                type="button"
              >
                ›
              </button>
            </div>
          </section>

          <section>
            <SectionTitle eyebrow="2" title="Choisissez un jour" />
            {visibleDays.length === 0 ? (
              <EmptyState message="Aucun créneau proposé ce mois-ci." />
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {visibleDays.map((day) => (
                  <DayButton
                    day={day}
                    isSelected={selectedDateKey === day.dateKey}
                    key={day.dateKey}
                    onSelect={() => {
                      setSelectedDateKey(day.dateKey);
                      setSelectedStartAt("");
                      setCreatedBooking(undefined);
                      setErrorMessage(undefined);
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          {selectedDay ? (
            <section>
              <SectionTitle eyebrow="3" title="Choisissez un horaire" />
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {selectedDayTimes.map((availableTime) => (
                  <TimeButton
                    isSelected={selectedStartAt === availableTime.startAt}
                    key={`${availableTime.durationMinutes}-${availableTime.startAt}`}
                    onSelect={() => {
                      setSelectedStartAt(availableTime.startAt);
                      setCreatedBooking(undefined);
                      setErrorMessage(undefined);
                    }}
                    time={availableTime}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {selectedTime ? (
            <>
              <ReservationSummary
                durationMinutes={durationMinutes}
                selectedTime={selectedTime}
                serviceLabel={serviceLabel}
              />

              <section>
                <SectionTitle eyebrow="4" title="Vos coordonnées" />
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <TextField
                    label="Prénom"
                    onChange={setClientFirstName}
                    required
                    value={clientFirstName}
                  />
                  <TextField
                    label="Nom"
                    onChange={setClientLastName}
                    required
                    value={clientLastName}
                  />
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <TextField
                    label="Email"
                    onChange={setClientEmail}
                    required
                    type="email"
                    value={clientEmail}
                  />
                  <TextField
                    label="Téléphone"
                    onChange={setClientPhone}
                    required
                    type="tel"
                    value={clientPhone}
                  />
                </div>

                <label className="mt-4 flex flex-col gap-2 text-sm font-medium">
                  Message optionnel
                  <textarea
                    className="min-h-28 rounded-xl border border-zinc-300 bg-white px-3 py-3 text-base outline-none transition focus:border-amber-600 focus:ring-2 focus:ring-amber-600/15"
                    onChange={(event) => setClientMessage(event.target.value)}
                    value={clientMessage}
                  />
                </label>

                <p className="mt-4 rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2 text-sm leading-6 text-amber-950">
                  Vous recevrez un email avec un lien à cliquer pour confirmer
                  votre rendez-vous.
                </p>
              </section>
            </>
          ) : null}
        </>
      )}

      {errorMessage ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      {selectedTime ? (
        <button
          className="h-12 w-full rounded-xl bg-amber-600 px-4 font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting
            ? "Envoi..."
            : "Recevoir mon email de confirmation"}
        </button>
      ) : null}
    </form>
  );
}

function SectionTitle({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-600 text-sm font-semibold text-white">
        {eyebrow}
      </span>
      <h2 className="text-base font-semibold text-zinc-950">{title}</h2>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="mt-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
      {message}
    </p>
  );
}

function DayButton({
  day,
  isSelected,
  onSelect,
}: {
  day: DisplayReservationDay;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      aria-pressed={isSelected}
      className={`min-h-20 rounded-xl border px-4 py-3 text-left transition ${
        isSelected
          ? "border-amber-600 bg-amber-600 text-white"
          : "border-zinc-200 bg-white text-zinc-800 hover:border-amber-300 hover:bg-amber-50"
      }`}
      onClick={onSelect}
      type="button"
    >
      <span className="block text-sm font-semibold capitalize">
        {getDayLabel(day.dateKey)}
      </span>
      <span
        className={`mt-1 block text-xs ${
          isSelected ? "text-amber-50" : "text-zinc-500"
        }`}
      >
        {day.times.length} horaire{day.times.length > 1 ? "s" : ""}
      </span>
    </button>
  );
}

function TimeButton({
  isSelected,
  onSelect,
  time,
}: {
  isSelected: boolean;
  onSelect: () => void;
  time: DisplayReservationTime;
}) {
  return (
    <button
      aria-pressed={isSelected}
      className={`h-14 rounded-xl border px-4 text-lg font-semibold transition ${
        isSelected
          ? "border-amber-600 bg-amber-600 text-white"
          : "border-zinc-200 bg-white text-zinc-900 hover:border-amber-300 hover:bg-amber-50"
      }`}
      onClick={onSelect}
      type="button"
    >
      {formatTime(time.startAt)}
    </button>
  );
}

function ReservationSummary({
  durationMinutes,
  selectedTime,
  serviceLabel,
}: {
  durationMinutes: number;
  selectedTime: DisplayReservationTime;
  serviceLabel?: string;
}) {
  return (
    <section className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
      <h2 className="text-sm font-semibold text-emerald-950">
        Votre rendez-vous
      </h2>
      <p className="mt-2 text-sm leading-6 text-emerald-900">
        {serviceLabel ?? "Séance"} de {durationMinutes === 90 ? "1h30" : "1h"}
        {" · "}
        {formatDate(selectedTime.startAt)} à {formatTime(selectedTime.startAt)}
      </p>
    </section>
  );
}

function ConfirmationSuccess({
  booking,
  durationMinutes,
  serviceLabel,
}: {
  booking: BookingResponse;
  durationMinutes: number;
  serviceLabel?: string;
}) {
  return (
    <section className="mx-auto w-full max-w-2xl rounded-2xl border border-emerald-200 bg-white/90 p-5 shadow-sm sm:p-6">
      <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
        Email envoyé
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
        Votre demande est presque confirmée
      </h2>
      <p className="mt-4 text-sm leading-6 text-zinc-700">
        Un email de confirmation vient de vous être envoyé pour votre{" "}
        {serviceLabel?.toLocaleLowerCase("fr-FR") ?? "séance"} de{" "}
        {durationMinutes === 90 ? "1h30" : "1h"}, le{" "}
        {formatDate(booking.startAt)} à {formatTime(booking.startAt)}.
      </p>
      <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50/80 p-4 text-sm leading-6 text-amber-950">
        <p className="font-semibold">Dernière étape</p>
        <p className="mt-2">
          Cliquez sur le lien reçu par email pour confirmer définitivement le
          rendez-vous. Pensez à vérifier vos spams. Sans cette validation par
          email, le rendez-vous n&apos;est pas confirmé.
        </p>
      </div>
    </section>
  );
}

function TextField({
  label,
  onChange,
  required = false,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium">
      {label}
      <input
        className="h-12 rounded-xl border border-zinc-300 bg-white px-3 text-base outline-none transition focus:border-amber-600 focus:ring-2 focus:ring-amber-600/15"
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}
