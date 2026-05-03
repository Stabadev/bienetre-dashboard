import type { CalendarResponse, ParameterValue, VEvent } from "node-ical";

export type CalendarEvent = {
  uid: string;
  title: string;
  startAt: string;
  endAt: string;
};

export class CalendarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalendarError";
  }
}

function getSummaryValue(summary: ParameterValue): string {
  return typeof summary === "string" ? summary : summary.val;
}

function toIsoString(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new CalendarError("Un événement iCal contient une date invalide.");
  }

  return date.toISOString();
}

function simplifyEvent(event: VEvent): CalendarEvent | null {
  if (!event.uid || !event.start) {
    return null;
  }

  const startAt = toIsoString(event.start);
  const endAt = event.end ? toIsoString(event.end) : startAt;

  return {
    uid: event.uid,
    title: getSummaryValue(event.summary) || "Rendez-vous sans titre",
    startAt,
    endAt,
  };
}

export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  const icalUrl = process.env.ICAL_SECRET_URL;

  if (!icalUrl) {
    throw new CalendarError(
      "La variable ICAL_SECRET_URL est absente du fichier .env.local.",
    );
  }

  let response: Response;

  try {
    response = await fetch(icalUrl, { cache: "no-store" });
  } catch {
    throw new CalendarError("Impossible de récupérer le calendrier iCal.");
  }

  if (!response.ok) {
    throw new CalendarError("L'URL iCal est invalide ou inaccessible.");
  }

  const icsContent = await response.text();
  const ical = await import("node-ical");
  const parsedCalendar = ical.parseICS(icsContent);

  return Object.values(parsedCalendar as CalendarResponse)
    .filter((entry): entry is VEvent => entry?.type === "VEVENT")
    .map(simplifyEvent)
    .filter((event): event is CalendarEvent => event !== null)
    .sort(
      (eventA, eventB) =>
        new Date(eventA.startAt).getTime() - new Date(eventB.startAt).getTime(),
    );
}
