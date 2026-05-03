import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type RouteContext = {
  params: Promise<{
    appointmentUid: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const { appointmentUid } = await context.params;

  await db.payment.deleteMany({
    where: {
      appointmentUid: decodeURIComponent(appointmentUid),
    },
  });

  return NextResponse.json({ ok: true });
}
