import { BookingSource, BookingStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAuthResponse } from "@/lib/auth";
import {
  CalendarError,
  getCalendarEvents,
  type CalendarEvent,
} from "@/lib/calendar";
import { db } from "@/lib/db";

type SyncError = {
  calendlyEventUri: string | null;
  message: string;
};

type SyncSummary = {
  created: number;
  updated: number;
  skipped: number;
  errors: SyncError[];
};

function readDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getCalendlyEventIdentifier(eventUri: string): string {
  return eventUri.split("/").filter(Boolean).at(-1) ?? "unknown";
}

function getFallbackEmail(eventUri: string): string {
  const identifier = getCalendlyEventIdentifier(eventUri)
    .toLocaleLowerCase("fr-FR")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";

  return `calendly-sans-email+${identifier}@local.invalid`;
}

function getClientName(event: CalendarEvent): string {
  const clientName = event.clientName?.trim();

  if (clientName) {
    return clientName;
  }

  const fullName = [event.clientFirstName, event.clientLastName]
    .map((name) => name?.trim())
    .filter(Boolean)
    .join(" ");

  if (fullName) {
    return fullName;
  }

  return event.clientEmail?.trim() || "Client Calendly";
}

function getExternalStatus(event: CalendarEvent): string | null {
  return event.inviteeStatus ?? event.eventStatus;
}

function buildBookingData(event: CalendarEvent, syncedAt: Date) {
  const externalEventUri = event.calendlyEventUri || event.uid;
  const startAt = readDate(event.startAt);
  const endAt = readDate(event.endAt);
  const externalUpdatedAt = readDate(event.updatedAt);

  if (!externalEventUri || !startAt || !endAt) {
    return null;
  }

  return {
    availabilitySlotId: null,
    clientEmail: event.clientEmail?.trim() || getFallbackEmail(externalEventUri),
    clientFirstName: event.clientFirstName,
    clientLastName: event.clientLastName,
    clientName: getClientName(event),
    clientPhone: event.clientPhone,
    endAt,
    externalEventTypeUri: event.eventTypeUri,
    externalEventUri,
    externalInviteeUri: event.calendlyInviteeUri,
    externalStatus: getExternalStatus(event),
    externalUpdatedAt,
    service: event.title?.trim() || "Rendez-vous Calendly",
    source: BookingSource.CALENDLY,
    startAt,
    status: BookingStatus.CONFIRMED,
    syncedAt,
  };
}

type CalendlyBookingData = NonNullable<ReturnType<typeof buildBookingData>>;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Erreur inconnue.";
}

export async function POST() {
  const authResponse = await requireAuthResponse();

  if (authResponse) {
    return authResponse;
  }

  let events: CalendarEvent[];

  try {
    const result = await getCalendarEvents({ forceRefresh: true });
    events = result.events;
  } catch (error) {
    const message =
      error instanceof CalendarError
        ? error.message
        : "Impossible de synchroniser Calendly.";

    return NextResponse.json({ error: message }, { status: 502 });
  }

  const syncedAt = new Date();
  const summary: SyncSummary = {
    created: 0,
    errors: [],
    skipped: 0,
    updated: 0,
  };
  const preparedBookings = events
    .map((event) => {
      const data = buildBookingData(event, syncedAt);

      if (!data) {
        summary.skipped += 1;
        summary.errors.push({
          calendlyEventUri: event.calendlyEventUri || event.uid || null,
          message: "Evenement Calendly invalide.",
        });
      }

      return data;
    })
    .filter((data): data is CalendlyBookingData => data !== null);
  const uniqueBookings = new Map<string, CalendlyBookingData>();

  for (const booking of preparedBookings) {
    if (uniqueBookings.has(booking.externalEventUri)) {
      summary.skipped += 1;
      summary.errors.push({
        calendlyEventUri: booking.externalEventUri,
        message: "Evenement Calendly duplique dans la reponse.",
      });
      continue;
    }

    uniqueBookings.set(booking.externalEventUri, booking);
  }

  const existingBookings = await db.booking.findMany({
    where: {
      externalEventUri: {
        in: [...uniqueBookings.keys()],
      },
      source: BookingSource.CALENDLY,
    },
    select: {
      externalEventUri: true,
    },
  });
  const existingEventUris = new Set(
    existingBookings
      .map((booking) => booking.externalEventUri)
      .filter((eventUri): eventUri is string => eventUri !== null),
  );

  for (const booking of uniqueBookings.values()) {
    try {
      await db.booking.upsert({
        create: booking,
        update: {
          availabilitySlotId: booking.availabilitySlotId,
          clientEmail: booking.clientEmail,
          clientFirstName: booking.clientFirstName,
          clientLastName: booking.clientLastName,
          clientName: booking.clientName,
          clientPhone: booking.clientPhone,
          endAt: booking.endAt,
          externalEventTypeUri: booking.externalEventTypeUri,
          externalInviteeUri: booking.externalInviteeUri,
          externalStatus: booking.externalStatus,
          externalUpdatedAt: booking.externalUpdatedAt,
          service: booking.service,
          startAt: booking.startAt,
          status: booking.status,
          syncedAt: booking.syncedAt,
        },
        where: {
          source_externalEventUri: {
            externalEventUri: booking.externalEventUri,
            source: BookingSource.CALENDLY,
          },
        },
      });

      if (existingEventUris.has(booking.externalEventUri)) {
        summary.updated += 1;
      } else {
        summary.created += 1;
      }
    } catch (error) {
      summary.skipped += 1;
      summary.errors.push({
        calendlyEventUri: booking.externalEventUri,
        message: getErrorMessage(error),
      });
    }
  }

  // PR1 importe seulement les evenements actifs retournes par getCalendarEvents().
  // Les annulations Calendly deja synchronisees seront traitees dans une PR ulterieure.
  return NextResponse.json(summary);
}
