import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireAuthResponse } from "@/lib/auth";
import { db } from "@/lib/db";

type RouteContext = {
  params: Promise<{
    appointmentUid: string;
  }>;
};

type InvoicePayload = {
  number: string;
  issueDate: string;
  sellerName: string;
  sellerAddress: string;
  sellerSiret: string;
  sellerPhone?: string | null;
  sellerEmail?: string | null;
  clientFirstName: string;
  clientLastName: string;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  service: string;
  serviceDate: string;
  amount: number;
  method: string;
  vatMention?: string;
  notes?: string | null;
};

function serializeInvoice(invoice: {
  id: string;
  paymentId: string;
  number: string;
  issueDate: Date;
  sellerName: string;
  sellerAddress: string;
  sellerSiret: string;
  sellerPhone: string | null;
  sellerEmail: string | null;
  clientFirstName: string;
  clientLastName: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  service: string;
  serviceDate: Date;
  amount: number;
  method: string;
  vatMention: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...invoice,
    issueDate: invoice.issueDate.toISOString(),
    serviceDate: invoice.serviceDate.toISOString(),
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
  };
}

function buildInvoiceData(
  body: InvoicePayload,
): Omit<
  Prisma.InvoiceUncheckedCreateInput,
  "id" | "paymentId" | "createdAt" | "updatedAt"
> {
  return {
    number: body.number,
    issueDate: new Date(body.issueDate),
    sellerName: body.sellerName,
    sellerAddress: body.sellerAddress,
    sellerSiret: body.sellerSiret,
    sellerPhone: body.sellerPhone,
    sellerEmail: body.sellerEmail,
    clientFirstName: body.clientFirstName,
    clientLastName: body.clientLastName,
    clientName: body.clientName,
    clientEmail: body.clientEmail,
    clientPhone: body.clientPhone,
    service: body.service,
    serviceDate: new Date(body.serviceDate),
    amount: body.amount,
    method: body.method,
    vatMention: body.vatMention ?? "TVA non applicable, art. 293 B du CGI",
    notes: body.notes,
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const authResponse = await requireAuthResponse();

  if (authResponse) {
    return authResponse;
  }

  const { appointmentUid } = await context.params;
  // Le segment reste nommé appointmentUid pour compatibilité avec les autres routes dynamiques Next.js,
  // mais les routes invoice reçoivent un Payment.id.
  const paymentId = decodeURIComponent(appointmentUid);

  const invoice = await db.invoice.findUnique({
    where: {
      paymentId,
    },
  });

  if (invoice) {
    return NextResponse.json(serializeInvoice(invoice));
  }

  const payment = await db.payment.findUnique({
    where: {
      id: paymentId,
    },
  });

  if (!payment) {
    return NextResponse.json({ error: "Paiement introuvable." }, { status: 404 });
  }

  return NextResponse.json({
    number: null,
    issueDate: new Date().toISOString(),
    clientFirstName: payment.clientFirstName,
    clientLastName: payment.clientLastName,
    clientName: payment.clientName,
    clientEmail: payment.clientEmail,
    clientPhone: payment.clientPhone,
    service: payment.service,
    serviceDate: payment.startAt.toISOString(),
    amount: payment.amount,
    method: payment.method,
  });
}

export async function POST(request: Request, context: RouteContext) {
  const authResponse = await requireAuthResponse();

  if (authResponse) {
    return authResponse;
  }

  const { appointmentUid } = await context.params;
  // Le segment reste nommé appointmentUid pour compatibilité avec les autres routes dynamiques Next.js,
  // mais les routes invoice reçoivent un Payment.id.
  const paymentId = decodeURIComponent(appointmentUid);

  let body: InvoicePayload;

  try {
    body = (await request.json()) as InvoicePayload;
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const data = buildInvoiceData(body);

  const payment = await db.payment.findUnique({
    where: {
      id: paymentId,
    },
    select: {
      id: true,
    },
  });

  if (!payment) {
    return NextResponse.json({ error: "Paiement introuvable." }, { status: 404 });
  }

  const [invoice] = await db.$transaction([
    db.invoice.upsert({
      where: {
        paymentId,
      },
      update: data,
      create: {
        ...data,
        paymentId,
      },
    }),
    db.payment.update({
      where: {
        id: paymentId,
      },
      data: {
        clientFirstName: data.clientFirstName,
        clientLastName: data.clientLastName,
        clientName: data.clientName,
      },
    }),
  ]);

  return NextResponse.json(serializeInvoice(invoice));
}
