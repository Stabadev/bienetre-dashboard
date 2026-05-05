"use client";

import type { CalendarEvent } from "@/lib/calendar";
import { formatCurrency, formatDate, formatTime } from "./formatters";
import type { SavedPayment } from "./types";

type AppointmentCardProps = {
  event: CalendarEvent;
  payment?: SavedPayment;
  onSelect: (event: CalendarEvent) => void;
};

function getClientLastName(
  event: CalendarEvent,
  payment?: SavedPayment,
): string {
  return (
    payment?.clientLastName ??
    payment?.clientName ??
    event.clientLastName ??
    event.clientName ??
    event.title
  ).toLocaleUpperCase("fr-FR");
}

function getClientFirstName(
  event: CalendarEvent,
  payment?: SavedPayment,
): string | null {
  return (
    payment?.clientFirstName ?? event.clientFirstName
  )?.toLocaleUpperCase("fr-FR") ?? null;
}

function getServiceLabel(event: CalendarEvent, payment?: SavedPayment): string {
  return payment?.service ?? event.title ?? "Prestation à préciser";
}

export function AppointmentCard({
  event,
  payment,
  onSelect,
}: AppointmentCardProps) {
  const isPaid = payment !== undefined;
  const clientFirstName = getClientFirstName(event, payment);
  const clientLastName = getClientLastName(event, payment);
  const clientEmail = event.clientEmail ?? "Email non renseigné";
  const clientPhone = event.clientPhone ?? "Téléphone non renseigné";
  const service = getServiceLabel(event, payment);

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
      <article className="grid gap-3 text-sm lg:grid-cols-[minmax(8.5rem,10rem)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(8.5rem,1fr)_minmax(11rem,1.2fr)_minmax(8rem,1fr)_minmax(8rem,auto)] lg:items-center lg:gap-4">
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
          <p className="text-xs font-medium text-zinc-500">Nom</p>
          <p className="truncate font-semibold text-zinc-950">{clientLastName}</p>
        </div>

        <div className="min-w-0">
          <p className="text-xs font-medium text-zinc-500">Prénom</p>
          {clientFirstName ? (
            <p className="truncate font-medium text-zinc-800">
              {clientFirstName}
            </p>
          ) : (
            <p className="text-zinc-400">-</p>
          )}
        </div>

        <div className="min-w-0">
          <p className="text-xs font-medium text-zinc-500">Téléphone</p>
          <p className="truncate font-medium text-zinc-800">{clientPhone}</p>
        </div>

        <div className="min-w-0">
          <p className="text-xs font-medium text-zinc-500">Email</p>
          <p className="truncate font-medium text-zinc-800">{clientEmail}</p>
        </div>

        <div className="min-w-0">
          <p className="text-xs font-medium text-zinc-500">Prestation</p>
          <p className="truncate font-medium text-zinc-800">{service}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span
            className={`font-semibold ${
              isPaid ? "text-emerald-800" : "text-amber-800"
            }`}
          >
            {payment ? formatCurrency(payment.amount) : "A saisir"}
          </span>
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
