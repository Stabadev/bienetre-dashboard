"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import type { CalendarEvent } from "@/lib/calendar";
import { buildClientName, normalizeClientName } from "@/lib/client-name";
import { AppointmentCard } from "./AppointmentCard";
import { PaymentModal } from "./PaymentModal";
import { formatCurrency } from "./formatters";
import type { PaymentDraft, SavedPayment } from "./types";

type DashboardClientProps = {
  events: CalendarEvent[];
  lastFetchedAt: string;
};

type SectionKey = "overdue" | "today" | "paid" | "upcoming";
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

function getWeekStart(date: Date): Date {
  const weekStart = new Date(date);
  const day = weekStart.getDay();
  const distanceFromMonday = day === 0 ? 6 : day - 1;

  weekStart.setDate(weekStart.getDate() - distanceFromMonday);
  weekStart.setHours(0, 0, 0, 0);

  return weekStart;
}

function getWeekEnd(date: Date): Date {
  const weekEnd = getWeekStart(date);

  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return weekEnd;
}

function isDateInCurrentWeek(value: string): boolean {
  const date = new Date(value);
  const now = new Date();

  return (
    date.getTime() >= getWeekStart(now).getTime() &&
    date.getTime() <= getWeekEnd(now).getTime()
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
  lastFetchedAt,
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
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>(
    {
      overdue: true,
      today: true,
      paid: true,
      upcoming: false,
    },
  );

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

  const displayedPayments = useMemo(
    () =>
      paidEvents
        .map((event) => paymentsByEventKey[getEventKey(event)])
        .filter((payment): payment is SavedPayment => payment !== undefined),
    [paidEvents, paymentsByEventKey],
  );

  const weeklyAmount = useMemo(
    () =>
      displayedPayments
        .filter((payment) =>
          isDateInCurrentWeek(payment.paidAt ?? payment.startAt),
        )
        .reduce((total, payment) => total + payment.amount, 0),
    [displayedPayments],
  );

  const selectedPayment = selectedEvent
    ? paymentsByEventKey[getEventKey(selectedEvent)]
    : undefined;

  function toggleSection(section: SectionKey) {
    setOpenSections((currentSections) => ({
      ...currentSections,
      [section]: !currentSections[section],
    }));
  }

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

  return (
    <>
      <div className="grid gap-6">
        <SummaryCards
          overdueCount={overdueEvents.length}
          paidCount={displayedPayments.length}
          todayCount={todayEvents.length}
          weeklyAmount={weeklyAmount}
        />

        <CalendarFreshness lastFetchedAt={lastFetchedAt} />

        <DashboardStatus
          isLoading={isLoadingPayments}
          message={paymentsLoadError}
        />

        <DashboardSection
          count={overdueEvents.length}
          emptyMessage="Aucun paiement en retard."
          events={overdueEvents}
          isOpen={openSections.overdue}
          onToggle={() => toggleSection("overdue")}
          onSelect={setSelectedEvent}
          paymentsByEventKey={paymentsByEventKey}
          tone="urgent"
          title="En retard"
        />

        <DashboardSection
          count={todayEvents.length}
          emptyMessage="Aucun paiement à renseigner aujourd'hui."
          events={todayEvents}
          isOpen={openSections.today}
          onToggle={() => toggleSection("today")}
          onSelect={setSelectedEvent}
          paymentsByEventKey={paymentsByEventKey}
          tone="active"
          title="Aujourd'hui"
        />

        <DashboardSection
          action={
            <button
              className="h-11 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
              onClick={downloadCsv}
              type="button"
            >
              Exporter CSV
            </button>
          }
          count={paidEvents.length}
          emptyMessage="Aucun paiement enregistré pour le moment."
          events={paidEvents}
          isOpen={openSections.paid}
          onToggle={() => toggleSection("paid")}
          onSelect={setSelectedEvent}
          paymentsByEventKey={paymentsByEventKey}
          tone="paid"
          title="Paiements enregistrés"
        />

        <DashboardSection
          count={upcomingEvents.length}
          emptyMessage="Aucun rendez-vous à venir sans paiement."
          events={upcomingEvents}
          isOpen={openSections.upcoming}
          onToggle={() => toggleSection("upcoming")}
          onSelect={setSelectedEvent}
          paymentsByEventKey={paymentsByEventKey}
          tone="muted"
          title="À venir"
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

function downloadCsv() {
  const link = document.createElement("a");

  link.href = "/api/export";
  link.download = "paiements-bienetre-dashboard.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function SummaryCards({
  overdueCount,
  paidCount,
  todayCount,
  weeklyAmount,
}: {
  overdueCount: number;
  paidCount: number;
  todayCount: number;
  weeklyAmount: number;
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
      label: "Encaissé cette semaine",
      value: formatCurrency(weeklyAmount),
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

function CalendarFreshness({ lastFetchedAt }: { lastFetchedAt: string }) {
  const minutesSinceRefresh = getMinutesSince(lastFetchedAt);
  const isPossiblyStale = minutesSinceRefresh >= 5;

  function refreshCalendar() {
    window.location.href = `/dashboard?refresh=${Date.now()}`;
  }

  return (
    <section
      className={`flex flex-col gap-3 rounded-3xl border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between ${
        isPossiblyStale
          ? "border-zinc-200 bg-white/60 text-zinc-600"
          : "border-emerald-100 bg-emerald-50/80 text-emerald-950"
      }`}
    >
      <div>
        <p className="text-sm font-semibold">
          Mis à jour il y a {minutesSinceRefresh} min
        </p>
        {isPossiblyStale ? (
          <p className="mt-1 text-sm">Données possiblement obsolètes</p>
        ) : null}
      </div>
      <button
        className="inline-flex h-10 w-fit items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-amber-300"
        onClick={refreshCalendar}
        type="button"
      >
        Rafraîchir
      </button>
    </section>
  );
}

function DashboardSection({
  action,
  count,
  emptyMessage,
  events,
  isOpen,
  onSelect,
  onToggle,
  paymentsByEventKey,
  title,
  tone,
}: {
  action?: ReactNode;
  count: number;
  emptyMessage: string;
  events: CalendarEvent[];
  isOpen: boolean;
  onSelect: (event: CalendarEvent) => void;
  onToggle: () => void;
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
        <button
          className={`flex w-fit items-center gap-2 text-left text-xl font-semibold ${toneStyles.title}`}
          onClick={onToggle}
          type="button"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-base shadow-sm">
            {isOpen ? "-" : "+"}
          </span>
          <span>
            {title} ({count})
          </span>
        </button>
        {action}
      </div>

      {isOpen ? (
        <AppointmentSection
          emptyMessage={emptyMessage}
          events={events}
          onSelect={onSelect}
          paymentsByEventKey={paymentsByEventKey}
        />
      ) : null}
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
