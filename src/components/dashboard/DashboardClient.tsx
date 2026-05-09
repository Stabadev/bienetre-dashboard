"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import type { CalendarEvent } from "@/lib/calendar";
import { buildClientName, normalizeClientName } from "@/lib/client-name";
import { AppointmentCard } from "./AppointmentCard";
import { PaymentModal } from "./PaymentModal";
import { formatCurrency } from "./formatters";
import type { PaymentDraft, SavedPayment } from "./types";

type DashboardClientProps = {
  events: CalendarEvent[];
  isCalendarStale: boolean;
  lastFetchedAt: string;
  refreshError: string | null;
};

type DashboardTabKey = "today" | "currentMonth" | "overdue" | "upcoming" | "paid";
type PaymentsByEventKey = Record<string, SavedPayment>;

const PAYMENTS_BY_EVENT_KEY_STORAGE_KEY =
  "bienetre-dashboard:paymentsByEventKey";

function getEventKey(event: CalendarEvent): string {
  return `${event.uid}-${event.startAt}`;
}

function sortEventsByStartAt(eventA: CalendarEvent, eventB: CalendarEvent) {
  return new Date(eventA.startAt).getTime() - new Date(eventB.startAt).getTime();
}

function isSameCalendarDay(dateA: Date, dateB: Date): boolean {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

function isDateInCurrentMonth(value: string): boolean {
  const date = new Date(value);
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

function getMinutesSince(value: string): number {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
}

function getClientName(event: CalendarEvent, payment: PaymentDraft): string {
  return (
    normalizeClientName(payment.clientName) ||
    normalizeClientName(event.clientName) ||
    buildClientName({
      clientFirstName: payment.clientFirstName,
      clientLastName: payment.clientLastName,
    }) ||
    buildClientName({
      clientFirstName: event.clientFirstName,
      clientLastName: event.clientLastName,
    })
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSavedPayment(value: unknown): value is SavedPayment {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.appointmentUid === "string" &&
    typeof value.title === "string" &&
    typeof value.startAt === "string" &&
    typeof value.endAt === "string" &&
    typeof value.amount === "number" &&
    typeof value.method === "string" &&
    typeof value.paidAt === "string"
  );
}

function isPaymentsByEventKey(value: unknown): value is PaymentsByEventKey {
  if (!isRecord(value)) {
    return false;
  }

  return Object.entries(value).every(
    ([eventKey, payment]) =>
      typeof eventKey === "string" &&
      isSavedPayment(payment) &&
      payment.appointmentUid === eventKey,
  );
}

function readCachedPaymentsByEventKey(): PaymentsByEventKey | null {
  if (typeof window === "undefined") {
    return null;
  }

  const cachedPayments = window.localStorage.getItem(
    PAYMENTS_BY_EVENT_KEY_STORAGE_KEY,
  );

  if (!cachedPayments) {
    return null;
  }

  try {
    const parsedPayments = JSON.parse(cachedPayments) as unknown;

    if (isPaymentsByEventKey(parsedPayments)) {
      return parsedPayments;
    }
  } catch {
    // Ignore invalid local cache and fall back to the API response.
  }

  window.localStorage.removeItem(PAYMENTS_BY_EVENT_KEY_STORAGE_KEY);

  return null;
}

function writeCachedPaymentsByEventKey(paymentsByEventKey: PaymentsByEventKey) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      PAYMENTS_BY_EVENT_KEY_STORAGE_KEY,
      JSON.stringify(paymentsByEventKey),
    );
  } catch {
    // localStorage can be unavailable or full; the database remains authoritative.
  }
}

function indexPaymentsByEventKey(payments: SavedPayment[]): PaymentsByEventKey {
  return payments.reduce<PaymentsByEventKey>((indexedPayments, payment) => {
    indexedPayments[payment.appointmentUid] = payment;
    return indexedPayments;
  }, {});
}

async function readErrorMessage(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  return payload?.error ?? "La requête a échoué.";
}

export function DashboardClient({
  events,
  isCalendarStale,
  lastFetchedAt,
  refreshError,
}: DashboardClientProps) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [paymentsByEventKey, setPaymentsByEventKey] =
    useState<PaymentsByEventKey>({});
  const [isDeletingPayment, setIsDeletingPayment] = useState(false);
  const [isLoadingPayments, setIsLoadingPayments] = useState(true);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [paymentsLoadError, setPaymentsLoadError] = useState<
    string | undefined
  >();
  const [paymentError, setPaymentError] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState<DashboardTabKey>("today");

  useEffect(() => {
    let isMounted = true;

    queueMicrotask(() => {
      if (!isMounted) {
        return;
      }

      const cachedPayments = readCachedPaymentsByEventKey();

      if (cachedPayments) {
        setPaymentsByEventKey(cachedPayments);
        setIsLoadingPayments(false);
      }
    });

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

        const indexedPayments = indexPaymentsByEventKey(payments);

        setPaymentsByEventKey(indexedPayments);
        writeCachedPaymentsByEventKey(indexedPayments);
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

  const sortedEvents = useMemo(
    () => [...events].sort(sortEventsByStartAt),
    [events],
  );

  const paidEvents = useMemo(
    () =>
      sortedEvents.filter((event) => paymentsByEventKey[getEventKey(event)] !== undefined),
    [sortedEvents, paymentsByEventKey],
  );

  const unpaidEvents = useMemo(
    () =>
      sortedEvents.filter((event) => paymentsByEventKey[getEventKey(event)] === undefined),
    [sortedEvents, paymentsByEventKey],
  );

  const overdueEvents = useMemo(() => {
    const now = new Date();

    return unpaidEvents.filter((event) => {
      const startAt = new Date(event.startAt);

      return startAt.getTime() < now.getTime() && !isSameCalendarDay(startAt, now);
    });
  }, [unpaidEvents]);

  const todayEvents = useMemo(() => {
    const now = new Date();

    return unpaidEvents.filter((event) =>
      isSameCalendarDay(new Date(event.startAt), now),
    );
  }, [unpaidEvents]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();

    return unpaidEvents.filter((event) => {
      const startAt = new Date(event.startAt);

      return startAt.getTime() > now.getTime() && !isSameCalendarDay(startAt, now);
    });
  }, [unpaidEvents]);

  const currentMonthUnpaidEvents = useMemo(
    () =>
      unpaidEvents.filter((event) => isDateInCurrentMonth(event.startAt)),
    [unpaidEvents],
  );

  const displayedPayments = useMemo(
    () =>
      paidEvents
        .map((event) => paymentsByEventKey[getEventKey(event)])
        .filter((payment): payment is SavedPayment => payment !== undefined),
    [paidEvents, paymentsByEventKey],
  );

  const currentMonthAmount = useMemo(
    () =>
      displayedPayments
        .filter((payment) =>
          isDateInCurrentMonth(payment.paidAt ?? payment.startAt),
        )
        .reduce((total, payment) => total + payment.amount, 0),
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
          calendlyEventUri: event.calendlyEventUri,
          calendlyInviteeUri: event.calendlyInviteeUri,
          title: event.title,
          clientFirstName: payment.clientFirstName,
          clientLastName: payment.clientLastName,
          clientName: getClientName(event, payment),
          clientEmail: event.clientEmail,
          clientPhone: event.clientPhone,
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

      setPaymentsByEventKey((currentPayments) => {
        const nextPayments = {
          ...currentPayments,
          [savedPayment.appointmentUid]: savedPayment,
        };

        writeCachedPaymentsByEventKey(nextPayments);

        return nextPayments;
      });
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
      "Supprimer ce paiement ? Le rendez-vous Calendly sera conservé.",
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

        writeCachedPaymentsByEventKey(nextPayments);

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

  const dashboardTabs = [
    {
      key: "today",
      title: "Aujourd'hui",
      count: todayEvents.length,
      emptyMessage: "Aucun paiement à renseigner aujourd'hui.",
      events: todayEvents,
      tone: "active",
    },
    {
      key: "currentMonth",
      title: "Mois en cours",
      count: currentMonthUnpaidEvents.length,
      emptyMessage: "Aucun paiement à traiter pour le mois en cours.",
      events: currentMonthUnpaidEvents,
      tone: "active",
    },
    {
      key: "overdue",
      title: "En retard",
      count: overdueEvents.length,
      emptyMessage: "Aucun paiement en retard.",
      events: overdueEvents,
      tone: "urgent",
    },
    {
      key: "upcoming",
      title: "À venir",
      count: upcomingEvents.length,
      emptyMessage: "Aucun rendez-vous à venir sans paiement.",
      events: upcomingEvents,
      tone: "muted",
    },
    {
      key: "paid",
      title: "Payés",
      count: paidEvents.length,
      emptyMessage: "Aucun paiement enregistré pour le moment.",
      events: paidEvents,
      tone: "paid",
      action: (
        <Link
          className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          href="/dashboard/export"
        >
          Voir l’export
        </Link>
      ),
    },
  ] satisfies Array<{
    key: DashboardTabKey;
    title: string;
    count: number;
    emptyMessage: string;
    events: CalendarEvent[];
    tone: "urgent" | "active" | "paid" | "muted";
    action?: ReactNode;
  }>;
  const activeDashboardTab =
    dashboardTabs.find((tab) => tab.key === activeTab) ?? dashboardTabs[0];

  return (
    <>
      <div className="grid gap-6">
        <SummaryCards
          currentMonthAmount={currentMonthAmount}
          overdueCount={overdueEvents.length}
          paidCount={displayedPayments.length}
          todayCount={todayEvents.length}
        />

        <CalendarFreshness
          isStale={isCalendarStale}
          lastFetchedAt={lastFetchedAt}
          refreshError={refreshError}
        />

        <DashboardStatus
          isLoading={isLoadingPayments}
          message={paymentsLoadError}
        />

        <div className="-mx-1 overflow-x-auto px-1">
          <div
            className="flex w-max min-w-full gap-2 rounded-2xl border border-zinc-200 bg-white/70 p-1 shadow-sm"
            role="tablist"
          >
            {dashboardTabs.map((tab) => {
              const isActive = activeTab === tab.key;

              return (
                <button
                  aria-selected={isActive}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition ${
                    isActive
                      ? "bg-zinc-950 text-white shadow-sm"
                      : "text-zinc-600 hover:bg-white hover:text-zinc-950"
                  }`}
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  role="tab"
                  type="button"
                >
                  <span>{tab.title}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      isActive
                        ? "bg-white/15 text-white"
                        : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <DashboardSection
          action={activeDashboardTab.action}
          count={activeDashboardTab.count}
          emptyMessage={activeDashboardTab.emptyMessage}
          events={activeDashboardTab.events}
          onSelect={setSelectedEvent}
          paymentsByEventKey={paymentsByEventKey}
          tone={activeDashboardTab.tone}
          title={activeDashboardTab.title}
        />
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

function SummaryCards({
  currentMonthAmount,
  overdueCount,
  paidCount,
  todayCount,
}: {
  currentMonthAmount: number;
  overdueCount: number;
  paidCount: number;
  todayCount: number;
}) {
  const cards = [
    {
      label: "En retard",
      value: overdueCount.toString(),
      className: "bg-amber-600 text-white",
      valueClassName: "text-white",
      labelClassName: "text-amber-50",
    },
    {
      label: "À traiter aujourd'hui",
      value: todayCount.toString(),
      className: "bg-emerald-50 text-emerald-950",
      valueClassName: "text-emerald-900",
      labelClassName: "text-emerald-700",
    },
    {
      label: "Encaissé ce mois-ci",
      value: formatCurrency(currentMonthAmount),
      className: "bg-zinc-950 text-white",
      valueClassName: "text-white",
      labelClassName: "text-zinc-300",
    },
    {
      label: "Paiements enregistrés",
      value: paidCount.toString(),
      className: "bg-white text-zinc-950",
      valueClassName: "text-zinc-950",
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

function CalendarFreshness({
  isStale,
  lastFetchedAt,
  refreshError,
}: {
  isStale: boolean;
  lastFetchedAt: string;
  refreshError: string | null;
}) {
  const minutesSinceRefresh = getMinutesSince(lastFetchedAt);
  const isPossiblyStale = isStale || minutesSinceRefresh >= 5;

  function refreshCalendar() {
    window.location.href = `/dashboard?refresh=${Date.now()}`;
  }

  const message = isStale
    ? `Refresh Calendly échoué · anciennes données d'il y a ${minutesSinceRefresh} min`
    : isPossiblyStale
      ? `Calendly possiblement obsolète · il y a ${minutesSinceRefresh} min`
      : `Calendly mis à jour il y a ${minutesSinceRefresh} min`;

  return (
    <div
      className={`flex flex-wrap items-center justify-end gap-2 text-xs ${
        isPossiblyStale
          ? "text-amber-700"
          : "text-zinc-500"
      }`}
    >
      <p title={refreshError ?? undefined}>{message}</p>
      <button
        className="inline-flex h-8 items-center justify-center rounded-lg border border-zinc-200 bg-white/70 px-3 font-medium text-zinc-600 transition hover:border-amber-300 hover:text-zinc-900"
        onClick={refreshCalendar}
        type="button"
      >
        Rafraîchir
      </button>
    </div>
  );
}

function DashboardSection({
  action,
  count,
  emptyMessage,
  events,
  onSelect,
  paymentsByEventKey,
  title,
  tone,
}: {
  action?: ReactNode;
  count: number;
  emptyMessage: string;
  events: CalendarEvent[];
  onSelect: (event: CalendarEvent) => void;
  paymentsByEventKey: Record<string, SavedPayment>;
  title: string;
  tone: "urgent" | "active" | "paid" | "muted";
}) {
  const toneStyles = {
    urgent: {
      section: "border-amber-200 bg-amber-50/85",
      title: "text-amber-950",
    },
    active: {
      section: "border-emerald-200 bg-emerald-50/80",
      title: "text-emerald-950",
    },
    paid: {
      section: "border-white/70 bg-white/75",
      title: "text-zinc-950",
    },
    muted: {
      section: "border-zinc-200 bg-white/55",
      title: "text-zinc-700",
    },
  }[tone];

  return (
    <section
      className={`rounded-3xl border p-4 shadow-sm backdrop-blur sm:p-6 ${toneStyles.section}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className={`text-xl font-semibold ${toneStyles.title}`}>
          <span>
            {title} ({count})
          </span>
        </h2>
        {action}
      </div>

      <AppointmentSection
        emptyMessage={emptyMessage}
        events={events}
        onSelect={onSelect}
        paymentsByEventKey={paymentsByEventKey}
      />
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
