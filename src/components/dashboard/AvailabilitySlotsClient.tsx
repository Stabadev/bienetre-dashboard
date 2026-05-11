"use client";

import { FormEvent, useState } from "react";
import { formatDate, formatTime } from "./formatters";

export type AvailabilitySlotView = {
  id: string;
  startAt: string;
  endAt: string;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type AvailabilitySlotsClientProps = {
  initialSlots: AvailabilitySlotView[];
};

function toDateTimeIso(date: string, time: string): string | null {
  if (!date || !time) {
    return null;
  }

  const value = new Date(`${date}T${time}`);

  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

async function readErrorMessage(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  return payload?.error ?? "La requête a échoué.";
}

export function AvailabilitySlotsClient({
  initialSlots,
}: AvailabilitySlotsClientProps) {
  const [slots, setSlots] = useState(initialSlots);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingSlotId, setDeletingSlotId] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>();

  async function createSlot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const startAt = toDateTimeIso(date, startTime);
    const endAt = toDateTimeIso(date, endTime);

    if (!startAt || !endAt) {
      setErrorMessage("Renseignez une date et des heures valides.");
      setSuccessMessage(undefined);
      return;
    }

    setIsSaving(true);
    setErrorMessage(undefined);
    setSuccessMessage(undefined);

    try {
      const response = await fetch("/api/availability-slots", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startAt,
          endAt,
          notes,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const createdSlot = (await response.json()) as AvailabilitySlotView;

      setSlots((currentSlots) =>
        [...currentSlots, createdSlot].sort(
          (slotA, slotB) =>
            new Date(slotA.startAt).getTime() -
            new Date(slotB.startAt).getTime(),
        ),
      );
      setDate("");
      setStartTime("");
      setEndTime("");
      setNotes("");
      setSuccessMessage("Plage de disponibilité ajoutée.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de créer la plage de disponibilité.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteSlot(slotId: string) {
    const confirmed = window.confirm("Supprimer cette plage de disponibilité ?");

    if (!confirmed) {
      return;
    }

    setDeletingSlotId(slotId);
    setErrorMessage(undefined);
    setSuccessMessage(undefined);

    try {
      const response = await fetch(
        `/api/availability-slots/${encodeURIComponent(slotId)}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      setSlots((currentSlots) =>
        currentSlots.filter((slot) => slot.id !== slotId),
      );
      setSuccessMessage("Plage de disponibilité supprimée.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de supprimer la plage de disponibilité.",
      );
    } finally {
      setDeletingSlotId(undefined);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <form
        className="rounded-2xl border border-white/70 bg-white/85 p-5 shadow-sm"
        onSubmit={createSlot}
      >
        <h2 className="text-xl font-semibold">Ajouter une plage</h2>

        <div className="mt-5 grid gap-4">
          <TextField
            label="Date"
            onChange={setDate}
            required
            type="date"
            value={date}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <TextField
              label="Début"
              onChange={setStartTime}
              required
              type="time"
              value={startTime}
            />
            <TextField
              label="Fin"
              onChange={setEndTime}
              required
              type="time"
              value={endTime}
            />
          </div>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Note interne
            <textarea
              className="min-h-24 rounded-xl border border-zinc-300 bg-white px-3 py-3 text-base outline-none transition focus:border-amber-600 focus:ring-2 focus:ring-amber-600/15"
              onChange={(event) => setNotes(event.target.value)}
              value={notes}
            />
          </label>
        </div>

        {errorMessage ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        {successMessage ? (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            {successMessage}
          </p>
        ) : null}

        <button
          className="mt-5 h-11 w-full rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
          disabled={isSaving}
          type="submit"
        >
          {isSaving ? "Ajout..." : "Ajouter la plage"}
        </button>
      </form>

      <section className="overflow-hidden rounded-2xl border border-white/70 bg-white/80 shadow-sm">
        <div className="border-b border-zinc-200 px-5 py-4">
          <h2 className="text-xl font-semibold">Plages existantes</h2>
          <p className="mt-1 text-sm text-zinc-600">
            {slots.length} plage{slots.length > 1 ? "s" : ""} de disponibilité
          </p>
        </div>

        {slots.length === 0 ? (
          <p className="p-6 text-sm text-zinc-600">
            Aucune plage de disponibilité pour le moment.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200">
            {slots.map((slot) => (
              <li
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                key={slot.id}
              >
                <div>
                  <p className="font-semibold text-zinc-950">
                    {formatDate(slot.startAt)}
                  </p>
                  <p className="mt-1 text-sm font-medium text-zinc-700">
                    {formatTime(slot.startAt)} - {formatTime(slot.endAt)}
                  </p>
                  {slot.notes ? (
                    <p className="mt-2 text-sm text-zinc-600">{slot.notes}</p>
                  ) : null}
                </div>

                <button
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-red-200 bg-white px-4 text-sm font-medium text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-300"
                  disabled={deletingSlotId === slot.id}
                  onClick={() => deleteSlot(slot.id)}
                  type="button"
                >
                  {deletingSlotId === slot.id ? "Suppression..." : "Supprimer"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
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
