import { NextResponse } from "next/server";
import { requireAuthResponse } from "@/lib/auth";
import { db } from "@/lib/db";

type AvailabilitySlotPayload = {
  startAt?: unknown;
  endAt?: unknown;
  notes?: unknown;
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

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export async function GET() {
  const authResponse = await requireAuthResponse();

  if (authResponse) {
    return authResponse;
  }

  const slots = await db.availabilitySlot.findMany({
    orderBy: {
      startAt: "asc",
    },
  });

  return NextResponse.json(slots.map(serializeAvailabilitySlot));
}

export async function POST(request: Request) {
  const authResponse = await requireAuthResponse();

  if (authResponse) {
    return authResponse;
  }

  let body: AvailabilitySlotPayload;

  try {
    body = (await request.json()) as AvailabilitySlotPayload;
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const startAt = readDate(body.startAt);
  const endAt = readDate(body.endAt);
  const notes = readOptionalString(body.notes);

  if (
    !startAt ||
    !endAt ||
    endAt.getTime() <= startAt.getTime()
  ) {
    return NextResponse.json(
      { error: "Plage de disponibilité invalide." },
      { status: 400 },
    );
  }

  const slot = await db.availabilitySlot.create({
    data: {
      startAt,
      endAt,
      notes,
    },
  });

  return NextResponse.json(serializeAvailabilitySlot(slot), { status: 201 });
}
