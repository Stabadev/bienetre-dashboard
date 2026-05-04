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
      className={`w-full border-b px-3 py-3 text-left transition last:border-b-0 hover:bg-white focus:outline-none focus:ring-2 focus:ring-amber-600 focus:ring-offset-2 sm:px-4 ${
        isPaid
          ? "border-emerald-100 bg-emerald-50/40"
          : "border-amber-200 bg-white"
      }`}
      onClick={() => onSelect(event)}
      type="button"
    >
      <article className="grid gap-2 text-sm sm:grid-cols-[minmax(8.5rem,11rem)_minmax(0,1.5fr)_minmax(8rem,1fr)_minmax(5.5rem,auto)_minmax(8rem,auto)] sm:items-center sm:gap-4">
        <div className="flex items-baseline gap-2 sm:block">
          <p className="font-semibold text-zinc-950">
            {formatTime(event.startAt)}
            <span className="font-normal text-zinc-500">
              {" "}
              - {formatTime(event.endAt)}
            </span>
          </p>
          <p className="truncate text-xs font-medium text-zinc-500 sm:mt-0.5">
            {formatDate(event.startAt)}
          </p>
        </div>

        <div className="min-w-0">
          <h3 className="truncate font-semibold text-zinc-950">
            {event.title}
          </h3>
          <p className="mt-0.5 truncate text-xs text-zinc-500 sm:hidden">
            {payment?.service ?? "Prestation à préciser"}
          </p>
        </div>

        <p className="hidden min-w-0 truncate text-zinc-600 sm:block">
          {payment?.service ?? "Prestation à préciser"}
        </p>

        <p
          className={`font-semibold ${
            isPaid ? "text-emerald-800" : "text-amber-800"
          }`}
        >
          {payment ? formatCurrency(payment.amount) : "A saisir"}
        </p>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span
            aria-label={
              isPaid ? "Paiement renseigné" : "Paiement non renseigné"
            }
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
              isPaid
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"
            }`}
            title={isPaid ? "Paiement renseigné" : "Paiement non renseigné"}
          >
            {payment ? payment.method : "Paiement à renseigner"}
          </span>
          <span className="text-xs font-semibold text-amber-700">
            {payment ? "Modifier" : "Ajouter"}
          </span>
        </div>
      </article>
    </button>
  );
}
