"use client";

import type { CalendarEvent } from "@/lib/calendar";
import { formatDate, formatTime } from "./formatters";
import type { SavedPayment } from "./types";

type AppointmentCardProps = {
  event: CalendarEvent;
  payment?: SavedPayment;
  onSelect: (event: CalendarEvent) => void;
};

export function AppointmentCard({
  event,
  payment,
  onSelect,
}: AppointmentCardProps) {
  const isPaid = payment !== undefined;

  return (
    <button
      className="w-full rounded-lg border border-zinc-200 bg-white p-5 text-left shadow-sm transition hover:border-zinc-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
      onClick={() => onSelect(event)}
      type="button"
    >
      <article>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{event.title}</h2>
            <p className="mt-2 text-sm text-zinc-600">
              {formatDate(event.startAt)}
            </p>
          </div>
          <span
            aria-label={
              isPaid ? "Paiement renseigné" : "Paiement non renseigné"
            }
            className="text-xl"
            title={isPaid ? "Paiement renseigné" : "Paiement non renseigné"}
          >
            {isPaid ? "✅" : "❓"}
          </span>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-zinc-500">Début</dt>
            <dd className="font-medium">{formatTime(event.startAt)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Fin</dt>
            <dd className="font-medium">{formatTime(event.endAt)}</dd>
          </div>
        </dl>

        {payment ? (
          <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            Payé par {payment.method}
          </p>
        ) : null}
      </article>
    </button>
  );
}
