import { NextResponse } from "next/server";
import { requireAuthResponse } from "@/lib/auth";
import { db } from "@/lib/db";

const paymentMethods = new Set(["espèces", "chèque", "virement", "carte"]);

type PaymentPayload = {
  appointmentUid?: unknown;
  title?: unknown;
  clientName?: unknown;
  service?: unknown;
  startAt?: unknown;
  endAt?: unknown;
  amount?: unknown;
  method?: unknown;
};

function serializePayment(payment: {
  id: string;
  appointmentUid: string;
  title: string;
  clientName: string | null;
  service: string | null;
  startAt: Date;
  endAt: Date;
  amount: number;
  method: string;
  paidAt: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...payment,
    startAt: payment.startAt.toISOString(),
    endAt: payment.endAt.toISOString(),
    paidAt: payment.paidAt.toISOString(),
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  };
}

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

function readAmount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return null;
  }

  return value;
}

export async function GET() {
  const authResponse = await requireAuthResponse();

  if (authResponse) {
    return authResponse;
  }

  const payments = await db.payment.findMany({
    orderBy: {
      startAt: "asc",
    },
  });

  return NextResponse.json(payments.map(serializePayment));
}

export async function POST(request: Request) {
  const authResponse = await requireAuthResponse();

  if (authResponse) {
    return authResponse;
  }

  let body: PaymentPayload;

  try {
    body = (await request.json()) as PaymentPayload;
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const appointmentUid = readRequiredString(body.appointmentUid);
  const title = readRequiredString(body.title);
  const startAt = readDate(body.startAt);
  const endAt = readDate(body.endAt);
  const amount = readAmount(body.amount);
  const method = readRequiredString(body.method);

  if (
    !appointmentUid ||
    !title ||
    !startAt ||
    !endAt ||
    amount === null ||
    !method ||
    !paymentMethods.has(method)
  ) {
    return NextResponse.json(
      { error: "Champs de paiement invalides." },
      { status: 400 },
    );
  }

  let payment;

  try {
    payment = await db.payment.upsert({
      where: {
        appointmentUid,
      },
      create: {
        appointmentUid,
        title,
        clientName: readOptionalString(body.clientName),
        service: readOptionalString(body.service),
        startAt,
        endAt,
        amount,
        method,
        paidAt: new Date(),
      },
      update: {
        title,
        clientName: readOptionalString(body.clientName),
        service: readOptionalString(body.service),
        startAt,
        endAt,
        amount,
        method,
        paidAt: new Date(),
      },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Impossible d'enregistrer le paiement en base. Vérifie DATABASE_URL, PostgreSQL et la migration Prisma.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json(serializePayment(payment));
}
