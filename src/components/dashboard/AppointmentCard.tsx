"use client";

import type { CalendarEvent } from "@/lib/calendar";
import { formatCurrency, formatDate, formatTime } from "./formatters";
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
      className={`w-full rounded-2xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-amber-600 focus:ring-offset-2 ${
        isPaid
          ? "border-emerald-100 bg-white/90"
          : "border-amber-200 bg-white"
      }`}
      onClick={() => onSelect(event)}
      type="button"
    >
      <article>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-500">Client</p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-950">
              {event.title}
            </h2>
            <p className="mt-2 text-sm text-zinc-600">
              {formatDate(event.startAt)}
            </p>
          </div>
          <span
            aria-label={
              isPaid ? "Paiement renseigné" : "Paiement non renseigné"
            }
            className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-sm font-medium ${
              isPaid
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"
            }`}
            title={isPaid ? "Paiement renseigné" : "Paiement non renseigné"}
          >
            {isPaid ? "✅ Paiement enregistré" : "❓ Paiement à renseigner"}
          </span>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-zinc-50 p-4 text-sm">
          <div>
            <dt className="text-zinc-500">Début</dt>
            <dd className="mt-1 font-semibold">{formatTime(event.startAt)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Fin</dt>
            <dd className="mt-1 font-semibold">{formatTime(event.endAt)}</dd>
          </div>
        </dl>

        {payment ? (
          <div className="mt-4 grid gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <p>
              <span className="font-semibold">
                {formatCurrency(payment.amount)}
              </span>{" "}
              par {payment.method}
            </p>
            {payment.service ? <p>{payment.service}</p> : null}
          </div>
        ) : null}
      </article>
    </button>
  );
}
