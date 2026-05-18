import { NextResponse } from "next/server";
import { requireAuthResponse } from "@/lib/auth";
import { db } from "@/lib/db";

type RouteContext = {
  params: Promise<{
    slotId: string;
  }>;
};

type AvailabilitySlotUpdatePayload = {
  startAt?: unknown;
  endAt?: unknown;
};

function serializeAvailabilitySlot(slot: {
  id: string;
  startAt: Date;
  endAt: Date;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...slot,
    startAt: slot.startAt.toISOString(),
    endAt: slot.endAt.toISOString(),
    createdAt: slot.createdAt.toISOString(),
    updatedAt: slot.updatedAt.toISOString(),
  };
}

function readDate(value: unknown): Date | null {
  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function isAlignedToQuarterHour(date: Date): boolean {
  return date.getMinutes() % 15 === 0 &&
    date.getSeconds() === 0 &&
    date.getMilliseconds() === 0;
}

export async function PATCH(request: Request, context: RouteContext) {
  const authResponse = await requireAuthResponse();

  if (authResponse) {
    return authResponse;
  }

  const { slotId } = await context.params;
  const decodedSlotId = decodeURIComponent(slotId);

  if (!decodedSlotId) {
    return NextResponse.json(
      { error: "Identifiant de disponibilité manquant." },
      { status: 400 },
    );
  }

  let body: AvailabilitySlotUpdatePayload;

  try {
    body = (await request.json()) as AvailabilitySlotUpdatePayload;
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const startAt = readDate(body.startAt);
  const endAt = readDate(body.endAt);

  if (!startAt || !endAt || endAt.getTime() <= startAt.getTime()) {
    return NextResponse.json(
      { error: "Plage de disponibilité invalide." },
      { status: 400 },
    );
  }

  if (!isAlignedToQuarterHour(startAt) || !isAlignedToQuarterHour(endAt)) {
    return NextResponse.json(
      { error: "Les horaires doivent être alignés sur 15 minutes." },
      { status: 400 },
    );
  }

  const existingSlot = await db.availabilitySlot.findUnique({
    where: {
      id: decodedSlotId,
    },
    select: {
      id: true,
    },
  });

  if (!existingSlot) {
    return NextResponse.json(
      { error: "Disponibilité introuvable." },
      { status: 404 },
    );
  }

  const slot = await db.availabilitySlot.update({
    where: {
      id: decodedSlotId,
    },
    data: {
      endAt,
      startAt,
    },
  });

  return NextResponse.json(serializeAvailabilitySlot(slot));
}

export async function DELETE(_request: Request, context: RouteContext) {
  const authResponse = await requireAuthResponse();

  if (authResponse) {
    return authResponse;
  }

  const { slotId } = await context.params;

  await db.availabilitySlot.deleteMany({
    where: {
      id: decodeURIComponent(slotId),
    },
  });

  return NextResponse.json({ ok: true });
}
