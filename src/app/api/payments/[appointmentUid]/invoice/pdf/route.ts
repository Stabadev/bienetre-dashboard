import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireAuthResponse } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildClientName } from "@/lib/client-name";
import { InvoicePdfDocument } from "@/components/invoices/InvoicePdfDocument";

type RouteContext = {
  params: Promise<{
    appointmentUid: string;
  }>;
};

export const runtime = "nodejs";

function formatDateForFilename(date: Date) {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");

  return `${year}${month}${day}`;
}

function safeFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getClientNameForFilename(invoice: {
  clientFirstName: string;
  clientLastName: string;
  clientName: string;
}) {
  return buildClientName({
    clientFirstName: invoice.clientFirstName,
    clientLastName: invoice.clientLastName,
    clientName: invoice.clientName,
  });
}

function getInvoiceFilename(invoice: {
  issueDate: Date;
  number: string;
  clientFirstName: string;
  clientLastName: string;
  clientName: string;
}) {
  const date = formatDateForFilename(invoice.issueDate);
  const number = safeFilename(invoice.number);
  const clientName = safeFilename(getClientNameForFilename(invoice));

  return `${date}_Facture-${number}_${clientName}.pdf`;
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

  if (!invoice) {
    return Response.json({ error: "Facture introuvable." }, { status: 404 });
  }

  const document = createElement(InvoicePdfDocument, {
    invoice,
  }) as Parameters<typeof renderToBuffer>[0];
  const pdfBuffer = await renderToBuffer(document);
  const filename = getInvoiceFilename(invoice);

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Type": "application/pdf",
    },
  });
}
