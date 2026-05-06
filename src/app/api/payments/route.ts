import { NextResponse } from "next/server";
import { requireAuthResponse } from "@/lib/auth";
import { db } from "@/lib/db";

const paymentMethods = new Set(["espèces", "chèque", "virement"]);

type PaymentPayload = {
  appointmentUid?: unknown;
  calendlyEventUri?: unknown;
  calendlyInviteeUri?: unknown;
  title?: unknown;
  clientFirstName?: unknown;
  clientLastName?: unknown;
  clientName?: unknown;
  clientEmail?: unknown;
  clientPhone?: unknown;
  service?: unknown;
  startAt?: unknown;
  endAt?: unknown;
  amount?: unknown;
  method?: unknown;
};

function serializePayment(payment: {
  id: string;
  appointmentUid: string;
  calendlyEventUri: string | null;
  calendlyInviteeUri: string | null;
  title: string;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  service: string | null;
  startAt: Date;
  endAt: Date;
  amount: number;
  method: string;
  paidAt: Date;
  createdAt: Date;
  updatedAt: Date;
  invoice?: {
    id: string;
  } | null;
}) {
  const { invoice, ...serializedPayment } = payment;

  return {
    ...serializedPayment,
    startAt: payment.startAt.toISOString(),
    endAt: payment.endAt.toISOString(),
    paidAt: payment.paidAt.toISOString(),
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
    hasInvoice: invoice !== undefined && invoice !== null,
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
    include: {
      invoice: {
        select: {
          id: true,
        },
      },
    },
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
  const calendlyEventUri = readOptionalString(body.calendlyEventUri);
  const calendlyInviteeUri = readOptionalString(body.calendlyInviteeUri);
  const clientFirstName = readOptionalString(body.clientFirstName);
  const clientLastName = readOptionalString(body.clientLastName);
  const clientName = readOptionalString(body.clientName);
  const clientEmail = readOptionalString(body.clientEmail);
  const clientPhone = readOptionalString(body.clientPhone);
  const service = readOptionalString(body.service);
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
        calendlyEventUri,
        calendlyInviteeUri,
        title,
        clientFirstName,
        clientLastName,
        clientName,
        clientEmail,
        clientPhone,
        service,
        startAt,
        endAt,
        amount,
        method,
        paidAt: new Date(),
      },
      update: {
        calendlyEventUri,
        calendlyInviteeUri,
        title,
        clientFirstName,
        clientLastName,
        clientName,
        clientEmail,
        clientPhone,
        service,
        startAt,
        endAt,
        amount,
        method,
        paidAt: new Date(),
      },
      include: {
        invoice: {
          select: {
            id: true,
          },
        },
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
