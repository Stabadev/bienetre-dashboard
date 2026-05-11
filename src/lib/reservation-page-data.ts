import { BookingStatus } from "@prisma/client";
import { db } from "@/lib/db";
import {
  buildAvailableReservationTimes,
  type AvailableReservationTime,
} from "@/lib/reservation-availability";

export async function getReservationPageData({
  durations,
}: {
  durations: number[];
}): Promise<{
  availableTimes: AvailableReservationTime[];
}> {
  const now = new Date();
  const availabilitySlots = await db.availabilitySlot.findMany({
    where: {
      isActive: true,
      endAt: {
        gt: now,
      },
    },
    orderBy: {
      startAt: "asc",
    },
    select: {
      id: true,
      startAt: true,
      endAt: true,
    },
  });
  const blockingBookings = await db.booking.findMany({
    where: {
      endAt: {
        gt: now,
      },
      status: {
        in: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
      },
    },
    orderBy: {
      startAt: "asc",
    },
    select: {
      startAt: true,
      endAt: true,
    },
  });

  return {
    availableTimes: durations.flatMap((durationMinutes) =>
      buildAvailableReservationTimes({
        availabilitySlots,
        blockingBookings,
        durationMinutes,
        now,
      }),
    ),
  };
}
