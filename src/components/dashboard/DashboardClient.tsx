"use client";

import { useEffect, useMemo, useState } from "react";
import type { CalendarEvent } from "@/lib/calendar";
import { AppointmentCard } from "./AppointmentCard";
import { PaymentModal } from "./PaymentModal";
import { PaymentsSidebar } from "./PaymentsSidebar";
import type { PaymentDraft, SavedPayment } from "./types";

type DashboardClientProps = {
  events: CalendarEvent[];
};

function getEventKey(event: CalendarEvent): string {
  return `${event.uid}-${event.startAt}`;
}

export function DashboardClient({ events }: DashboardClientProps) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [paymentsByEventKey, setPaymentsByEventKey] = useState<
    Record<string, SavedPayment>
  >({});
  const [isDeletingPayment, setIsDeletingPayment] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | undefined>();

  useEffect(() => {
    let isMounted = true;

    async function loadPayments() {
      const response = await fetch("/api/payments");

      if (!response.ok) {
        return;
      }

      const payments = (await response.json()) as SavedPayment[];

      if (!isMounted) {
        return;
      }

      setPaymentsByEventKey(
        payments.reduce<Record<string, SavedPayment>>((indexedPayments, payment) => {
          indexedPayments[payment.appointmentUid] = payment;
          return indexedPayments;
        }, {}),
      );
    }

    loadPayments();

    return () => {
      isMounted = false;
    };
  }, []);

  const payments = useMemo(
    () =>
      Object.values(paymentsByEventKey).sort(
        (paymentA, paymentB) =>
          new Date(paymentA.startAt).getTime() -
          new Date(paymentB.startAt).getTime(),
      ),
    [paymentsByEventKey],
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
        throw new Error("La sauvegarde du paiement a échoué.");
      }

      const savedPayment = (await response.json()) as SavedPayment;

      setPaymentsByEventKey((currentPayments) => ({
        ...currentPayments,
        [savedPayment.appointmentUid]: savedPayment,
      }));
      setSelectedEvent(null);
    } catch {
      setPaymentError("Impossible d'enregistrer le paiement.");
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
        throw new Error("La suppression du paiement a échoué.");
      }

      setPaymentsByEventKey((currentPayments) => {
        const nextPayments = { ...currentPayments };
        delete nextPayments[appointmentUid];
        return nextPayments;
      });
      setSelectedEvent(null);
    } catch {
      setPaymentError("Impossible de supprimer le paiement.");
    } finally {
      setIsDeletingPayment(false);
    }
  }

  return (
    <>
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0">
          {events.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-zinc-600">
              Aucun rendez-vous trouvé dans le calendrier.
            </p>
          ) : (
            <div className="grid gap-4">
              {events.map((event) => (
                <AppointmentCard
                  event={event}
                  key={getEventKey(event)}
                  onSelect={setSelectedEvent}
                  payment={paymentsByEventKey[getEventKey(event)]}
                />
              ))}
            </div>
          )}
        </section>

        <PaymentsSidebar payments={payments} />
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
