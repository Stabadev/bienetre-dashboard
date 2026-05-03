import { NextResponse } from "next/server";
import { requireAuthResponse } from "@/lib/auth";
import { db } from "@/lib/db";

type RouteContext = {
  params: Promise<{
    appointmentUid: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const authResponse = await requireAuthResponse();

  if (authResponse) {
    return authResponse;
  }

  const { appointmentUid } = await context.params;

  await db.payment.deleteMany({
    where: {
      appointmentUid: decodeURIComponent(appointmentUid),
    },
  });

  return NextResponse.json({ ok: true });
}
