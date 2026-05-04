"use client";

import { useEffect, useMemo, useState } from "react";
import type { CalendarEvent } from "@/lib/calendar";
import { AppointmentCard } from "./AppointmentCard";
import { PaymentModal } from "./PaymentModal";
import { formatCurrency } from "./formatters";
import type { PaymentDraft, SavedPayment } from "./types";

type DashboardClientProps = {
  events: CalendarEvent[];
};

function getEventKey(event: CalendarEvent): string {
  return `${event.uid}-${event.startAt}`;
}

function getDisplayWindowEnd(): Date {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 7);
  endDate.setHours(23, 59, 59, 999);

  return endDate;
}

function sortEventsByStartAt(eventA: CalendarEvent, eventB: CalendarEvent) {
  return new Date(eventA.startAt).getTime() - new Date(eventB.startAt).getTime();
}

async function readErrorMessage(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  return payload?.error ?? "La requête a échoué.";
}

export function DashboardClient({ events }: DashboardClientProps) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [paymentsByEventKey, setPaymentsByEventKey] = useState<
    Record<string, SavedPayment>
  >({});
  const [isDeletingPayment, setIsDeletingPayment] = useState(false);
  const [isLoadingPayments, setIsLoadingPayments] = useState(true);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [paymentsLoadError, setPaymentsLoadError] = useState<
    string | undefined
  >();
  const [paymentError, setPaymentError] = useState<string | undefined>();

  useEffect(() => {
    let isMounted = true;

    async function loadPayments() {
      try {
        const response = await fetch("/api/payments");

        if (!response.ok) {
          throw new Error(await readErrorMessage(response));
        }

        const payments = (await response.json()) as SavedPayment[];

        if (!isMounted) {
          return;
        }

        setPaymentsByEventKey(
          payments.reduce<Record<string, SavedPayment>>(
            (indexedPayments, payment) => {
              indexedPayments[payment.appointmentUid] = payment;
              return indexedPayments;
            },
            {},
          ),
        );
      } catch {
        if (isMounted) {
          setPaymentsLoadError("Impossible de charger les paiements.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingPayments(false);
        }
      }
    }

    loadPayments();

    return () => {
      isMounted = false;
    };
  }, []);

  const displayedEvents = useMemo(
    () =>
      events
        .filter(
          (event) => new Date(event.startAt).getTime() <= getDisplayWindowEnd().getTime(),
        )
        .sort(sortEventsByStartAt),
    [events],
  );

  const unpaidEvents = useMemo(
    () =>
      displayedEvents.filter((event) => paymentsByEventKey[getEventKey(event)] === undefined),
    [displayedEvents, paymentsByEventKey],
  );

  const paidEvents = useMemo(
    () =>
      displayedEvents.filter((event) => paymentsByEventKey[getEventKey(event)] !== undefined),
    [displayedEvents, paymentsByEventKey],
  );

  const displayedPayments = useMemo(
    () =>
      paidEvents
        .map((event) => paymentsByEventKey[getEventKey(event)])
        .filter((payment): payment is SavedPayment => payment !== undefined),
    [paidEvents, paymentsByEventKey],
  );

  const totalAmount = useMemo(
    () =>
      displayedPayments.reduce(
        (total, payment) => total + payment.amount,
        0,
      ),
    [displayedPayments],
  );

  const selectedPayment = selectedEvent
    ? paymentsByEventKey[getEventKey(selectedEvent)]
    : undefined;

  async function savePayment(event: CalendarEvent, payment: PaymentDraft) {
    setIsSavingPayment(true);
    setPaymentError(undefined);

    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          appointmentUid: getEventKey(event),
          title: event.title,
          clientName: event.title,
          service: payment.service,
          startAt: event.startAt,
          endAt: event.endAt,
          amount: payment.amount,
          method: payment.method,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const savedPayment = (await response.json()) as SavedPayment;

      setPaymentsByEventKey((currentPayments) => ({
        ...currentPayments,
        [savedPayment.appointmentUid]: savedPayment,
      }));
      setSelectedEvent(null);
    } catch (error) {
      setPaymentError(
        error instanceof Error
          ? error.message
          : "Impossible d'enregistrer le paiement.",
      );
    } finally {
      setIsSavingPayment(false);
    }
  }

  async function deletePayment(event: CalendarEvent) {
    const appointmentUid = getEventKey(event);
    const confirmed = window.confirm(
      "Supprimer ce paiement ? Le rendez-vous Google Calendar sera conservé.",
    );

    if (!confirmed) {
      return;
    }

    setIsDeletingPayment(true);
    setPaymentError(undefined);

    try {
      const response = await fetch(
        `/api/payments/${encodeURIComponent(appointmentUid)}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      setPaymentsByEventKey((currentPayments) => {
        const nextPayments = { ...currentPayments };
        delete nextPayments[appointmentUid];
        return nextPayments;
      });
      setSelectedEvent(null);
    } catch (error) {
      setPaymentError(
        error instanceof Error
          ? error.message
          : "Impossible de supprimer le paiement.",
      );
    } finally {
      setIsDeletingPayment(false);
    }
  }

  return (
    <>
      <div className="grid gap-6">
        <SummaryCards
          paidCount={displayedPayments.length}
          totalAmount={totalAmount}
          unpaidCount={unpaidEvents.length}
        />

        <section className="rounded-3xl border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Paiements à renseigner</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Rendez-vous passés et 7 prochains jours sans paiement.
              </p>
            </div>
            <span className="inline-flex w-fit rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
              {unpaidEvents.length} à traiter
            </span>
          </div>

          <DashboardStatus
            isLoading={isLoadingPayments}
            message={paymentsLoadError}
          />

          <AppointmentSection
            emptyMessage="Aucun paiement à renseigner sur la période affichée."
            events={unpaidEvents}
            onSelect={setSelectedEvent}
            paymentsByEventKey={paymentsByEventKey}
          />
        </section>

        <section className="rounded-3xl border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Paiements enregistrés</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Paiements sauvegardés pour les rendez-vous affichés.
              </p>
            </div>
            <button
              className="h-11 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
              onClick={downloadCsv}
              type="button"
            >
              Exporter CSV
            </button>
          </div>

          <AppointmentSection
            emptyMessage="Aucun paiement enregistré pour le moment."
            events={paidEvents}
            onSelect={setSelectedEvent}
            paymentsByEventKey={paymentsByEventKey}
          />
        </section>
      </div>

      {selectedEvent ? (
        <PaymentModal
          event={selectedEvent}
          errorMessage={paymentError}
          existingPayment={selectedPayment}
          isDeleting={isDeletingPayment}
          isSaving={isSavingPayment}
          onClose={() => setSelectedEvent(null)}
          onDelete={() => deletePayment(selectedEvent)}
          onValidate={(payment) => savePayment(selectedEvent, payment)}
        />
      ) : null}
    </>
  );
}

function downloadCsv() {
  const link = document.createElement("a");

  link.href = "/api/export";
  link.download = "paiements-bienetre-dashboard.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function SummaryCards({
  paidCount,
  totalAmount,
  unpaidCount,
}: {
  paidCount: number;
  totalAmount: number;
  unpaidCount: number;
}) {
  const cards = [
    {
      label: "Total encaissé",
      value: formatCurrency(totalAmount),
      className: "bg-zinc-950 text-white",
      valueClassName: "text-white",
      labelClassName: "text-zinc-300",
    },
    {
      label: "Paiements enregistrés",
      value: paidCount.toString(),
      className: "bg-emerald-50 text-emerald-950",
      valueClassName: "text-emerald-900",
      labelClassName: "text-emerald-700",
    },
    {
      label: "Paiements à renseigner",
      value: unpaidCount.toString(),
      className: "bg-amber-50 text-amber-950",
      valueClassName: "text-amber-900",
      labelClassName: "text-amber-700",
    },
    {
      label: "Période affichée",
      value: "Passé + 7 jours",
      className: "bg-white text-zinc-950",
      valueClassName: "text-zinc-950 text-xl",
      labelClassName: "text-zinc-500",
    },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <article
          className={`rounded-3xl border border-white/70 p-5 shadow-sm ${card.className}`}
          key={card.label}
        >
          <p className={`text-sm font-medium ${card.labelClassName}`}>
            {card.label}
          </p>
          <p className={`mt-3 text-3xl font-semibold ${card.valueClassName}`}>
            {card.value}
          </p>
        </article>
      ))}
    </section>
  );
}

function DashboardStatus({
  isLoading,
  message,
}: {
  isLoading: boolean;
  message?: string;
}) {
  if (isLoading) {
    return (
      <p className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
        Chargement des paiements...
      </p>
    );
  }

  if (message) {
    return (
      <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {message}
      </p>
    );
  }

  return null;
}

function AppointmentSection({
  emptyMessage,
  events,
  onSelect,
  paymentsByEventKey,
}: {
  emptyMessage: string;
  events: CalendarEvent[];
  onSelect: (event: CalendarEvent) => void;
  paymentsByEventKey: Record<string, SavedPayment>;
}) {
  if (events.length === 0) {
    return (
      <p className="mt-5 rounded-2xl border border-dashed border-zinc-300 bg-white/80 p-6 text-sm text-zinc-600">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-zinc-200 bg-white/80">
      {events.map((event) => (
        <AppointmentCard
          event={event}
          key={getEventKey(event)}
          onSelect={onSelect}
          payment={paymentsByEventKey[getEventKey(event)]}
        />
      ))}
    </div>
  );
}
