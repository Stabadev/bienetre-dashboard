const CALENDLY_API_BASE_URL = "https://api.calendly.com";
const CALENDAR_CACHE_DURATION_MS = 5 * 60 * 1000;

export type CalendarEvent = {
  uid: string;
  title: string;
  startAt: string;
  endAt: string;
  calendlyEventUri: string;
  calendlyInviteeUri: string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  eventStatus: string | null;
  inviteeStatus: string | null;
  eventTypeUri: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export class CalendarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalendarError";
  }
}

type CalendlyUserResponse = {
  resource?: {
    uri?: unknown;
  };
};

type CalendlyScheduledEventsResponse = {
  collection?: CalendlyScheduledEvent[];
  pagination?: {
    next_page?: unknown;
  };
};

type CalendlyInviteesResponse = {
  collection?: CalendlyInvitee[];
};

type CalendlyScheduledEvent = {
  uri?: unknown;
  name?: unknown;
  start_time?: unknown;
  end_time?: unknown;
  status?: unknown;
  event_type?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

type CalendlyInvitee = {
  uri?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  name?: unknown;
  email?: unknown;
  text_reminder_number?: unknown;
  status?: unknown;
};

type CalendarEventsCache = {
  events: CalendarEvent[];
  expiresAt: number;
};

let calendarEventsCache: CalendarEventsCache | null = null;

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function readRequiredString(value: unknown, errorMessage: string): string {
  const stringValue = readString(value);

  if (!stringValue) {
    throw new CalendarError(errorMessage);
  }

  return stringValue;
}

function toIsoString(value: string, errorMessage: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new CalendarError(errorMessage);
  }

  return date.toISOString();
}

function getCalendlyEventUuid(eventUri: string): string {
  const uuid = eventUri.split("/").filter(Boolean).at(-1);

  if (!uuid) {
    throw new CalendarError("Un rendez-vous Calendly contient une URI invalide.");
  }

  return uuid;
}

async function fetchCalendlyJson<T>(
  url: string,
  token: string,
  errorMessage: string,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
  } catch {
    throw new CalendarError(errorMessage);
  }

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");

    throw new CalendarError(
      `${errorMessage} URL: ${url}. Status HTTP: ${response.status}. Réponse Calendly: ${
        responseText || "(réponse vide)"
      }`,
    );
  }

  return (await response.json()) as T;
}

async function getCalendlyUserUri(token: string): Promise<string> {
  const payload = await fetchCalendlyJson<CalendlyUserResponse>(
    `${CALENDLY_API_BASE_URL}/users/me`,
    token,
    "Impossible de récupérer l'utilisateur Calendly.",
  );

  return readRequiredString(
    payload.resource?.uri,
    "La réponse Calendly ne contient pas d'utilisateur valide.",
  );
}

async function getCalendlyScheduledEvents(
  token: string,
  userUri: string,
): Promise<CalendlyScheduledEvent[]> {
  const minStartTime = new Date();
  minStartTime.setDate(minStartTime.getDate() - 30);

  const maxStartTime = new Date();
  maxStartTime.setDate(maxStartTime.getDate() + 30);

  const scheduledEventsUrl = new URL(
    `${CALENDLY_API_BASE_URL}/scheduled_events`,
  );

  scheduledEventsUrl.searchParams.set("user", userUri);
  scheduledEventsUrl.searchParams.set("min_start_time", minStartTime.toISOString());
  scheduledEventsUrl.searchParams.set("max_start_time", maxStartTime.toISOString());
  scheduledEventsUrl.searchParams.set("count", "15");
  scheduledEventsUrl.searchParams.set("sort", "start_time:asc");

  const events: CalendlyScheduledEvent[] = [];
  let nextUrl: string | null = scheduledEventsUrl.toString();

  while (nextUrl) {
    const payload = await fetchCalendlyJson<CalendlyScheduledEventsResponse>(
      nextUrl,
      token,
      "Impossible de récupérer les rendez-vous Calendly.",
    );

    events.push(...(payload.collection ?? []));
    nextUrl = readString(payload.pagination?.next_page);
  }

  return events;
}

async function getCalendlyInvitee(
  token: string,
  eventUri: string,
): Promise<CalendlyInvitee | null> {
  const eventUuid = getCalendlyEventUuid(eventUri);
  const payload = await fetchCalendlyJson<CalendlyInviteesResponse>(
    `${CALENDLY_API_BASE_URL}/scheduled_events/${encodeURIComponent(
      eventUuid,
    )}/invitees`,
    token,
    "Impossible de récupérer les invités Calendly.",
  );

  return payload.collection?.[0] ?? null;
}

function simplifyCalendlyEvent(
  event: CalendlyScheduledEvent,
  invitee: CalendlyInvitee | null,
): CalendarEvent {
  const eventUri = readRequiredString(
    event.uri,
    "Un rendez-vous Calendly ne contient pas d'URI.",
  );
  const startTime = readRequiredString(
    event.start_time,
    "Un rendez-vous Calendly ne contient pas de date de début.",
  );
  const endTime = readString(event.end_time) ?? startTime;

  return {
    uid: eventUri,
    title: readString(event.name) ?? "Rendez-vous sans titre",
    startAt: toIsoString(
      startTime,
      "Un rendez-vous Calendly contient une date de début invalide.",
    ),
    endAt: toIsoString(
      endTime,
      "Un rendez-vous Calendly contient une date de fin invalide.",
    ),
    calendlyEventUri: eventUri,
    calendlyInviteeUri: readString(invitee?.uri),
    clientFirstName: readString(invitee?.first_name),
    clientLastName: readString(invitee?.last_name),
    clientName: readString(invitee?.name),
    clientEmail: readString(invitee?.email),
    clientPhone: readString(invitee?.text_reminder_number),
    eventStatus: readString(event.status),
    inviteeStatus: readString(invitee?.status),
    eventTypeUri: readString(event.event_type),
    createdAt: readString(event.created_at),
    updatedAt: readString(event.updated_at),
  };
}

async function fetchCalendarEventsFromCalendly(): Promise<CalendarEvent[]> {
  const calendlyToken = process.env.CALENDLY_TOKEN;

  if (!calendlyToken) {
    throw new CalendarError(
      "La variable CALENDLY_TOKEN est absente du fichier .env.local.",
    );
  }

  const userUri = await getCalendlyUserUri(calendlyToken);
  const events = await getCalendlyScheduledEvents(calendlyToken, userUri);
  const activeEvents = events.filter(
    (event) => readString(event.status) === "active",
  );

  const calendarEvents = await Promise.all(
    activeEvents.map(async (event) => {
      const eventUri = readRequiredString(
        event.uri,
        "Un rendez-vous Calendly ne contient pas d'URI.",
      );
      const invitee = await getCalendlyInvitee(calendlyToken, eventUri);

      return simplifyCalendlyEvent(event, invitee);
    }),
  );

  return calendarEvents.sort(
    (eventA, eventB) =>
      new Date(eventA.startAt).getTime() - new Date(eventB.startAt).getTime(),
  );
}

export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  const now = Date.now();

  if (calendarEventsCache && calendarEventsCache.expiresAt > now) {
    return calendarEventsCache.events;
  }

  try {
    const events = await fetchCalendarEventsFromCalendly();

    // Cache volontairement court pour limiter les appels Calendly sans masquer
    // longtemps les changements de planning.
    calendarEventsCache = {
      events,
      expiresAt: now + CALENDAR_CACHE_DURATION_MS,
    };

    return events;
  } catch (error) {
    if (calendarEventsCache) {
      return calendarEventsCache.events;
    }

    throw error;
  }
}
