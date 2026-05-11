import { BookingStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAuthResponse } from "@/lib/auth";
import { db } from "@/lib/db";

type RouteContext = {
  params: Promise<{
    bookingId: string;
  }>;
};

type BookingUpdatePayload = {
  status?: unknown;
};

function serializeBooking(booking: {
  id: string;
  source: string;
  status: BookingStatus;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  clientMessage: string | null;
  service: string | null;
  startAt: Date;
  endAt: Date;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...booking,
    startAt: booking.startAt.toISOString(),
    endAt: booking.endAt.toISOString(),
    confirmedAt: booking.confirmedAt?.toISOString() ?? null,
    cancelledAt: booking.cancelledAt?.toISOString() ?? null,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  };
}

function readBookingStatus(value: unknown): BookingStatus | null {
  if (value === BookingStatus.CONFIRMED) {
    return BookingStatus.CONFIRMED;
  }

  if (value === BookingStatus.CANCELLED) {
    return BookingStatus.CANCELLED;
  }

  return null;
}

export async function PATCH(request: Request, context: RouteContext) {
  const authResponse = await requireAuthResponse();

  if (authResponse) {
    return authResponse;
  }

  let body: BookingUpdatePayload;

  try {
    body = (await request.json()) as BookingUpdatePayload;
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const status = readBookingStatus(body.status);

  if (!status) {
    return NextResponse.json(
      { error: "Statut de réservation invalide." },
      { status: 400 },
    );
  }

  const { bookingId } = await context.params;
  const decodedBookingId = decodeURIComponent(bookingId);
  const existingBooking = await db.booking.findUnique({
    where: {
      id: decodedBookingId,
    },
    select: {
      id: true,
    },
  });

  if (!existingBooking) {
    return NextResponse.json(
      { error: "Réservation introuvable." },
      { status: 404 },
    );
  }

  const now = new Date();
  const booking = await db.booking.update({
    where: {
      id: decodedBookingId,
    },
    data:
      status === BookingStatus.CONFIRMED
        ? {
            cancelledAt: null,
            confirmationTokenExpiresAt: null,
            confirmationTokenHash: null,
            confirmedAt: now,
            status,
          }
        : {
            cancelledAt: now,
            confirmationTokenExpiresAt: null,
            confirmationTokenHash: null,
            status,
          },
  });

  return NextResponse.json(serializeBooking(booking));
}
