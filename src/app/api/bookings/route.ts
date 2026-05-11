import { BookingStatus, BookingSource } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const allowedDurations = new Set([60, 90]);

type BookingPayload = {
  startAt?: unknown;
  durationMinutes?: unknown;
  clientFirstName?: unknown;
  clientLastName?: unknown;
  clientEmail?: unknown;
  clientPhone?: unknown;
  clientMessage?: unknown;
};

function readRequiredString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function readDate(value: unknown): Date | null {
  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function readDuration(value: unknown): number | null {
  return typeof value === "number" && allowedDurations.has(value) ? value : null;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function serializeBooking(booking: {
  id: string;
  status: BookingStatus;
  startAt: Date;
  endAt: Date;
  service: string | null;
  createdAt: Date;
}) {
  return {
    id: booking.id,
    status: booking.status,
    startAt: booking.startAt.toISOString(),
    endAt: booking.endAt.toISOString(),
    service: booking.service,
    createdAt: booking.createdAt.toISOString(),
  };
}

export async function POST(request: Request) {
  let body: BookingPayload;

  try {
    body = (await request.json()) as BookingPayload;
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const startAt = readDate(body.startAt);
  const durationMinutes = readDuration(body.durationMinutes);
  const clientFirstName = readRequiredString(body.clientFirstName);
  const clientLastName = readRequiredString(body.clientLastName);
  const clientEmail = readRequiredString(body.clientEmail);
  const clientPhone = readRequiredString(body.clientPhone);
  const clientMessage = readOptionalString(body.clientMessage);

  if (
    !startAt ||
    durationMinutes === null ||
    !clientFirstName ||
    !clientLastName ||
    !clientEmail ||
    !isValidEmail(clientEmail) ||
    !clientPhone
  ) {
    return NextResponse.json(
      { error: "Demande de réservation invalide." },
      { status: 400 },
    );
  }

  const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);
  const clientName = `${clientFirstName} ${clientLastName}`.trim();
  const service =
    durationMinutes === 90 ? "Séance 1h30" : "Séance 1h";

  const availabilitySlot = await db.availabilitySlot.findFirst({
    where: {
      isActive: true,
      startAt: {
        lte: startAt,
      },
      endAt: {
        gte: endAt,
      },
    },
    orderBy: {
      startAt: "asc",
    },
  });

  if (!availabilitySlot) {
    return NextResponse.json(
      { error: "Cette demande n'est pas dans une plage disponible." },
      { status: 409 },
    );
  }

  const overlappingBooking = await db.booking.findFirst({
    where: {
      status: {
        in: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
      },
      startAt: {
        lt: endAt,
      },
      endAt: {
        gt: startAt,
      },
    },
    select: {
      id: true,
    },
  });

  if (overlappingBooking) {
    return NextResponse.json(
      { error: "Cet horaire est déjà demandé ou réservé." },
      { status: 409 },
    );
  }

  const booking = await db.booking.create({
    data: {
      availabilitySlotId: availabilitySlot.id,
      source: BookingSource.INTERNAL,
      status: BookingStatus.PENDING,
      clientFirstName,
      clientLastName,
      clientName,
      clientEmail,
      clientPhone,
      clientMessage,
      service,
      startAt,
      endAt,
    },
    select: {
      id: true,
      status: true,
      startAt: true,
      endAt: true,
      service: true,
      createdAt: true,
    },
  });

  return NextResponse.json(serializeBooking(booking), { status: 201 });
}
