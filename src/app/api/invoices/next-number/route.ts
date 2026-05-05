import { NextResponse } from "next/server";
import { requireAuthResponse } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const authResponse = await requireAuthResponse();

  if (authResponse) {
    return authResponse;
  }

  const year = new Date().getFullYear();
  const prefix = `${year}-`;

  const latestInvoice = await db.invoice.findFirst({
    where: {
      number: {
        startsWith: prefix,
      },
    },
    orderBy: {
      number: "desc",
    },
  });

  if (!latestInvoice) {
    return NextResponse.json({ nextNumber: `${prefix}001` });
  }

  const latestNumber = Number(latestInvoice.number.split("-")[1]);
  const nextSequence = latestNumber + 1;
  const nextNumber = `${prefix}${String(nextSequence).padStart(3, "0")}`;

  return NextResponse.json({ nextNumber });
}
