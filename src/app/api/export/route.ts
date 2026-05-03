import { requireAuthResponse } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildPaymentsCsv } from "@/lib/csv";

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

  const csv = buildPaymentsCsv(payments);

  return new Response(csv, {
    headers: {
      "Content-Disposition":
        'attachment; filename="paiements-bienetre-dashboard.csv"',
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
