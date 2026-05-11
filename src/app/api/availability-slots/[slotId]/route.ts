import { NextResponse } from "next/server";
import { requireAuthResponse } from "@/lib/auth";
import { db } from "@/lib/db";

type RouteContext = {
  params: Promise<{
    slotId: string;
  }>;
};

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
