const stepMinutes = 30;
const stepMs = stepMinutes * 60_000;

export type AvailabilityWindow = {
  id: string;
  startAt: Date;
  endAt: Date;
};

export type BlockingBooking = {
  startAt: Date;
  endAt: Date;
};

export type AvailableReservationTime = {
  availabilitySlotId: string;
  durationMinutes: number;
  startAt: string;
  endAt: string;
};

function ceilToStep(date: Date): Date {
  return new Date(Math.ceil(date.getTime() / stepMs) * stepMs);
}

function overlaps({
  booking,
  endAt,
  startAt,
}: {
  booking: BlockingBooking;
  endAt: Date;
  startAt: Date;
}): boolean {
  return startAt.getTime() < booking.endAt.getTime() &&
    endAt.getTime() > booking.startAt.getTime();
}

export function buildAvailableReservationTimes({
  availabilitySlots,
  blockingBookings,
  durationMinutes,
  now = new Date(),
}: {
  availabilitySlots: AvailabilityWindow[];
  blockingBookings: BlockingBooking[];
  durationMinutes: number;
  now?: Date;
}): AvailableReservationTime[] {
  const durationMs = durationMinutes * 60_000;
  const availableTimes = new Map<string, AvailableReservationTime>();

  for (const slot of availabilitySlots) {
    const firstStartAt = ceilToStep(
      new Date(Math.max(slot.startAt.getTime(), now.getTime())),
    );

    for (
      let startAt = firstStartAt;
      startAt.getTime() + durationMs <= slot.endAt.getTime();
      startAt = new Date(startAt.getTime() + stepMs)
    ) {
      const endAt = new Date(startAt.getTime() + durationMs);
      const hasOverlap = blockingBookings.some((booking) =>
        overlaps({ booking, endAt, startAt }),
      );

      if (!hasOverlap) {
        availableTimes.set(`${durationMinutes}:${startAt.toISOString()}`, {
          availabilitySlotId: slot.id,
          durationMinutes,
          endAt: endAt.toISOString(),
          startAt: startAt.toISOString(),
        });
      }
    }
  }

  return [...availableTimes.values()].sort(
    (timeA, timeB) =>
      new Date(timeA.startAt).getTime() - new Date(timeB.startAt).getTime(),
  );
}
