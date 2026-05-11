"use client";

import { FormEvent, useMemo, useState } from "react";
import { formatDate, formatTime } from "@/components/dashboard/formatters";

type ReservationFormProps = {
  availableTimes: AvailableReservationTimeView[];
  fixedDurationMinutes?: 60 | 90;
  serviceDescription?: string;
  serviceLabel?: string;
};

type AvailableReservationTimeView = {
  availabilitySlotId: string;
  durationMinutes: number;
  startAt: string;
  endAt: string;
};

type BookingResponse = {
  id: string;
  startAt: string;
  endAt: string;
  service: string | null;
  status: string;
};

const durationOptions = [
  { description: "Rendez-vous de suivi", label: "1h", value: 60 },
  { description: "Premier rendez-vous", label: "1h30", value: 90 },
];

const parisDateKeyFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Europe/Paris",
  year: "numeric",
});

function getParisDateKey(value: string): string {
  const parts = parisDateKeyFormatter.formatToParts(new Date(value));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function dateFromKey(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00`);
}

function getDayLabel(dateKey: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    timeZone: "Europe/Paris",
    weekday: "short",
  }).format(dateFromKey(dateKey));
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);

  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

function buildCalendarDays(availableDateKeys: string[]): string[] {
  if (availableDateKeys.length === 0) {
    return [];
  }

  const sortedKeys = [...availableDateKeys].sort();
  const firstDay = dateFromKey(sortedKeys[0]);
  const lastDay = dateFromKey(sortedKeys.at(-1) ?? sortedKeys[0]);
  const days: string[] = [];

  for (
    let day = firstDay;
    day.getTime() <= lastDay.getTime();
    day = addDays(day, 1)
  ) {
    days.push(day.toISOString().slice(0, 10));
  }

  return days;
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
  const [selectedDurationMinutes, setSelectedDurationMinutes] = useState(60);
  const durationMinutes = fixedDurationMinutes ?? selectedDurationMinutes;
  const isDurationFixed = fixedDurationMinutes !== undefined;
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
  const timesByDate = useMemo(
    () =>
      filteredAvailableTimes.reduce<Record<string, AvailableReservationTimeView[]>>(
        (groupedTimes, availableTime) => {
          const dateKey = getParisDateKey(availableTime.startAt);

          return {
            ...groupedTimes,
            [dateKey]: [...(groupedTimes[dateKey] ?? []), availableTime],
          };
        },
        {},
      ),
    [filteredAvailableTimes],
  );
  const availableDateKeys = useMemo(
    () => Object.keys(timesByDate).sort(),
    [timesByDate],
  );
  const calendarDays = useMemo(
    () => buildCalendarDays(availableDateKeys),
    [availableDateKeys],
  );
  const visibleSelectedDateKey =
    selectedDateKey && timesByDate[selectedDateKey]
      ? selectedDateKey
      : availableDateKeys[0] ?? "";
  const selectedDayTimes = visibleSelectedDateKey
    ? timesByDate[visibleSelectedDateKey] ?? []
    : [];

  async function submitReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedStartAt) {
      setErrorMessage("Choisissez un horaire disponible.");
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

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <form
        className="rounded-2xl border border-white/70 bg-white/85 p-5 shadow-sm sm:p-6"
        onSubmit={submitReservation}
      >
        <div className="grid gap-5">
          {isDurationFixed ? (
            <section className="rounded-xl border border-amber-100 bg-amber-50/70 p-4">
              <p className="text-sm font-semibold text-amber-950">
                {serviceLabel ?? "Séance"} ·{" "}
                {durationMinutes === 90 ? "1h30" : "1h"}
              </p>
              {serviceDescription ? (
                <p className="mt-2 text-sm leading-6 text-zinc-700">
                  {serviceDescription}
                </p>
              ) : null}
            </section>
          ) : (
            <fieldset>
              <legend className="text-sm font-semibold">Durée de séance</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {durationOptions.map((option) => {
                  const isSelected = durationMinutes === option.value;

                  return (
                    <button
                      aria-pressed={isSelected}
                      className={`h-11 rounded-xl border px-4 text-sm font-semibold transition ${
                        isSelected
                          ? "border-amber-600 bg-amber-600 text-white"
                          : "border-zinc-200 bg-white text-zinc-800 hover:border-amber-300 hover:bg-amber-50"
                      }`}
                      key={option.value}
                      onClick={() => {
                        setSelectedDurationMinutes(option.value);
                        setSelectedDateKey("");
                        setSelectedStartAt("");
                        setCreatedBooking(undefined);
                        setErrorMessage(undefined);
                      }}
                      type="button"
                    >
                      <span className="block">{option.label}</span>
                      <span
                        className={`mt-0.5 block text-xs font-medium ${
                          isSelected ? "text-amber-50" : "text-zinc-500"
                        }`}
                      >
                        {option.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          <fieldset>
            <legend className="text-sm font-semibold">
              Jour souhaité
            </legend>
            {filteredAvailableTimes.length === 0 ? (
              <p className="mt-2 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
                Aucun horaire disponible pour cette durée.
              </p>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {calendarDays.map((dateKey) => {
                  const isAvailable = timesByDate[dateKey] !== undefined;
                  const isSelected = visibleSelectedDateKey === dateKey;

                  return (
                    <button
                      aria-pressed={isSelected}
                      className={`min-h-16 rounded-xl border px-3 py-2 text-left text-sm transition ${
                        isSelected
                          ? "border-amber-600 bg-amber-600 text-white"
                          : isAvailable
                            ? "border-zinc-200 bg-white text-zinc-800 hover:border-amber-300 hover:bg-amber-50"
                            : "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400"
                      }`}
                      disabled={!isAvailable}
                      key={dateKey}
                      onClick={() => {
                        setSelectedDateKey(dateKey);
                        setSelectedStartAt("");
                        setCreatedBooking(undefined);
                        setErrorMessage(undefined);
                      }}
                      type="button"
                    >
                      <span className="block font-semibold">
                        {getDayLabel(dateKey)}
                      </span>
                      {isAvailable ? (
                        <span
                          className={`mt-1 block text-xs ${
                            isSelected ? "text-amber-50" : "text-zinc-500"
                          }`}
                        >
                          {timesByDate[dateKey].length} horaire
                          {timesByDate[dateKey].length > 1 ? "s" : ""}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </fieldset>

          {filteredAvailableTimes.length > 0 ? (
            <fieldset>
              <legend className="text-sm font-semibold">
                Horaire disponible
              </legend>
              {selectedDayTimes.length === 0 ? (
                <p className="mt-2 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
                  Sélectionnez un jour disponible.
                </p>
              ) : (
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {selectedDayTimes.map((availableTime) => {
                    const isSelected =
                      selectedStartAt === availableTime.startAt;

                    return (
                      <button
                        aria-pressed={isSelected}
                        className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
                          isSelected
                            ? "border-amber-600 bg-amber-600 text-white"
                            : "border-zinc-200 bg-white text-zinc-800 hover:border-amber-300 hover:bg-amber-50"
                        }`}
                        key={`${availableTime.durationMinutes}-${availableTime.startAt}`}
                        onClick={() => {
                          setSelectedStartAt(availableTime.startAt);
                          setCreatedBooking(undefined);
                          setErrorMessage(undefined);
                        }}
                        type="button"
                      >
                        <span className="block font-semibold">
                          {formatTime(availableTime.startAt)} -{" "}
                          {formatTime(availableTime.endAt)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </fieldset>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
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

          <div className="grid gap-4 sm:grid-cols-2">
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

          <label className="flex flex-col gap-2 text-sm font-medium">
            Message optionnel
            <textarea
              className="min-h-28 rounded-xl border border-zinc-300 bg-white px-3 py-3 text-base outline-none transition focus:border-amber-600 focus:ring-2 focus:ring-amber-600/15"
              onChange={(event) => setClientMessage(event.target.value)}
              value={clientMessage}
            />
          </label>
        </div>

        {errorMessage ? (
          <p className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        {createdBooking ? (
          <p className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            Demande enregistrée pour le {formatDate(createdBooking.startAt)} à{" "}
            {formatTime(createdBooking.startAt)}. Un email de confirmation vient
            d&apos;être envoyé.
          </p>
        ) : null}

        <button
          className="mt-6 h-12 w-full rounded-xl bg-amber-600 px-4 font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Envoi..." : "Envoyer la demande"}
        </button>
      </form>

      <aside className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Votre demande</h2>
        <dl className="mt-4 flex flex-col gap-3 text-sm">
          <div>
            <dt className="font-medium text-zinc-500">Durée</dt>
            <dd className="mt-1 font-semibold text-zinc-950">
              {durationMinutes === 90 ? "1h30" : "1h"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-500">Jour</dt>
            <dd className="mt-1 font-semibold text-zinc-950">
              {visibleSelectedDateKey
                ? formatDate(dateFromKey(visibleSelectedDateKey).toISOString())
                : "À sélectionner"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-500">Horaire</dt>
            <dd className="mt-1 font-semibold text-zinc-950">
              {selectedStartAt ? formatTime(selectedStartAt) : "À sélectionner"}
            </dd>
          </div>
        </dl>

        <p className="mt-5 text-xs leading-5 text-zinc-500">
          Les jours cliquables ont au moins un horaire disponible. Les horaires
          proposés tiennent compte des demandes en attente et des réservations
          confirmées.
        </p>
      </aside>
    </div>
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
        className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-base outline-none transition focus:border-amber-600 focus:ring-2 focus:ring-amber-600/15"
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}
