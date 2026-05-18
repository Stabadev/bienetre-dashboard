"use client";

import Link from "next/link";
import type { CalendarEvent } from "@/lib/calendar";
import { formatCurrency, formatDate, formatTime } from "./formatters";
import type { SavedPayment } from "./types";

type AppointmentCardProps = {
  event: CalendarEvent;
  payment?: SavedPayment;
  onSelect: (event: CalendarEvent) => void;
};

function getClientName(event: CalendarEvent, payment?: SavedPayment): string {
  const legacyName = [
    payment?.clientFirstName ?? event.clientFirstName,
    payment?.clientLastName ?? event.clientLastName,
  ]
    .filter(Boolean)
    .join(" ");
  const clientName = payment?.clientName ?? event.clientName ?? legacyName;

  return (clientName || "Client non renseigné").toLocaleUpperCase("fr-FR");
}

function getServiceLabel(event: CalendarEvent, payment?: SavedPayment): string {
  return payment?.service ?? event.title ?? "Prestation à préciser";
}

function getSourceLabel(event: CalendarEvent): string {
  return event.uid.startsWith("booking:") ? "Interne" : "Calendly";
}

export function AppointmentCard({
  event,
  payment,
  onSelect,
}: AppointmentCardProps) {
  const isPaid = payment !== undefined;
  const clientName = getClientName(event, payment);
  const clientEmail = event.clientEmail ?? "Email non renseigné";
  const clientPhone = event.clientPhone ?? "Téléphone non renseigné";
  const service = getServiceLabel(event, payment);
  const sourceLabel = getSourceLabel(event);

  return (
    <article
      className={`w-full border-b px-3 py-3 text-left transition last:border-b-0 hover:bg-white focus:outline-none focus:ring-2 focus:ring-amber-600 focus:ring-offset-2 sm:px-4 ${
        isPaid
          ? "border-emerald-100 bg-emerald-50/40"
          : "border-amber-200 bg-white"
      }`}
    >
      <article className="grid gap-3 text-sm lg:grid-cols-[minmax(8.5rem,10rem)_minmax(10rem,1.8fr)_minmax(8.5rem,1fr)_minmax(11rem,1.2fr)_minmax(8rem,1fr)_minmax(8rem,auto)] lg:items-center lg:gap-4">
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
          <p className="text-xs font-medium text-zinc-500">Client</p>
          <p className="truncate font-semibold text-zinc-950">{clientName}</p>
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
          <span
            className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
              sourceLabel === "Interne"
                ? "bg-zinc-100 text-zinc-700"
                : "bg-sky-100 text-sky-800"
            }`}
          >
            {sourceLabel}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {payment ? (
            <>
              <span className="font-semibold text-emerald-800">
                {formatCurrency(payment.amount)}
              </span>
              <span
                aria-label="Paiement renseigné"
                className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800"
                title="Paiement renseigné"
              >
                {payment.method}
              </span>
            </>
          ) : null}
          <button
            className="inline-flex h-9 items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-amber-700 shadow-sm transition hover:border-amber-300 hover:bg-amber-50"
            onClick={() => onSelect(event)}
            type="button"
          >
            {payment ? "Modifier le paiement" : "Enregistrer le paiement"}
          </button>
          {payment ? (
            <Link
              className="inline-flex h-9 items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 shadow-sm transition hover:border-amber-300 hover:bg-amber-50"
              href={`/dashboard/payments/${payment.id}/invoice`}
            >
              {payment.hasInvoice ? "Voir la facture" : "Créer la facture"}
            </Link>
          ) : null}
        </div>
      </article>
    </article>
  );
}
