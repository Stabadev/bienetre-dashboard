"use client";

import { FormEvent, useMemo, useState } from "react";
import { formatDate, formatTime } from "@/components/dashboard/formatters";

type AvailabilitySlotView = {
  id: string;
  startAt: string;
  endAt: string;
};

type ReservationFormProps = {
  availabilitySlots: AvailabilitySlotView[];
};

type BookingResponse = {
  id: string;
  startAt: string;
  endAt: string;
  service: string | null;
  status: string;
};

const durationOptions = [
  { label: "1h", value: 60 },
  { label: "1h30", value: 90 },
];

function toDateTimeIso(date: string, time: string): string | null {
  if (!date || !time) {
    return null;
  }

  const value = new Date(`${date}T${time}`);

  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

function getDateInputValue(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

async function readErrorMessage(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  return payload?.error ?? "La demande de réservation a échoué.";
}

export function ReservationForm({ availabilitySlots }: ReservationFormProps) {
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [clientFirstName, setClientFirstName] = useState("");
  const [clientLastName, setClientLastName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientMessage, setClientMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [createdBooking, setCreatedBooking] = useState<BookingResponse>();

  const availableDates = useMemo(
    () =>
      Array.from(
        new Set(availabilitySlots.map((slot) => getDateInputValue(slot.startAt))),
      ),
    [availabilitySlots],
  );

  async function submitReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const startAt = toDateTimeIso(date, time);

    if (!startAt) {
      setErrorMessage("Choisissez une date et une heure valides.");
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
          startAt,
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
      setDate("");
      setTime("");
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
                    onClick={() => setDurationMinutes(option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Date souhaitée"
              onChange={setDate}
              required
              type="date"
              value={date}
            />
            <TextField
              label="Heure souhaitée"
              onChange={setTime}
              required
              type="time"
              value={time}
            />
          </div>

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
        <h2 className="text-lg font-semibold">Plages disponibles</h2>
        {availabilitySlots.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600">
            Aucune plage de disponibilité n&apos;est ouverte pour le moment.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {availabilitySlots.map((slot) => (
              <li
                className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm"
                key={slot.id}
              >
                <p className="font-semibold text-zinc-950">
                  {formatDate(slot.startAt)}
                </p>
                <p className="mt-1 text-zinc-600">
                  {formatTime(slot.startAt)} - {formatTime(slot.endAt)}
                </p>
              </li>
            ))}
          </ul>
        )}

        {availableDates.length > 0 ? (
          <p className="mt-4 text-xs leading-5 text-zinc-500">
            Les demandes doivent rester dans ces plages. Les réservations déjà
            demandées ne sont pas affichées ici.
          </p>
        ) : null}
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
