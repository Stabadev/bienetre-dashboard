export type DisplayReservationTime = {
  availabilitySlotId: string;
  durationMinutes: number;
  startAt: string;
  endAt: string;
};

export type DisplayAvailabilitySlot = {
  id: string;
  startAt: Date;
  endAt: Date;
};

export type DisplayBlockingBooking = {
  startAt: Date;
  endAt: Date;
};

export type DisplayReservationDay = {
  dateKey: string;
  times: DisplayReservationTime[];
};

export type DisplayReservationMonth = {
  days: DisplayReservationDay[];
  monthKey: string;
};

export type DisplayReservationCalendar = {
  months: DisplayReservationMonth[];
  monthsByKey: Record<string, DisplayReservationMonth>;
};

type BoundaryKind = "availability" | "booking" | "now";

type FreeBlock = {
  availabilitySlotId: string;
  endAt: Date;
  leftBoundary: BoundaryKind;
  rightBoundary: BoundaryKind;
  startAt: Date;
};

type DisplayTimeCandidate = {
  hasThirtyMinuteGap: boolean;
  time: DisplayReservationTime;
  touchesBooking: boolean;
};

type BlockEdgeCandidate = DisplayTimeCandidate & {
  edge: "start" | "end";
};

const maxTimesPerDay = 4;
const technicalStepMs = 15 * 60_000;
const thirtyMinutesMs = 30 * 60_000;
const parisDatePartsFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Europe/Paris",
  year: "numeric",
});
const parisMonthPartsFormatter = new Intl.DateTimeFormat("fr-FR", {
  month: "2-digit",
  timeZone: "Europe/Paris",
  year: "numeric",
});
const parisTimePartsFormatter = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

function readParisDateParts(value: string | Date) {
  const parts = parisDatePartsFormatter.formatToParts(new Date(value));
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";

  return { day, month, year };
}

export function getParisDateKey(value: string | Date): string {
  const { day, month, year } = readParisDateParts(value);

  return `${year}-${month}-${day}`;
}

export function getParisMonthKey(value: string | Date): string {
  const parts = parisMonthPartsFormatter.formatToParts(new Date(value));
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";

  return `${year}-${month}`;
}

export function getParisTimeKey(value: string | Date): string {
  const parts = parisTimePartsFormatter.formatToParts(new Date(value));
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";

  return `${hour}:${minute}`;
}

function ceilToStep(date: Date): Date {
  return new Date(Math.ceil(date.getTime() / technicalStepMs) * technicalStepMs);
}

function floorToStep(date: Date): Date {
  return new Date(Math.floor(date.getTime() / technicalStepMs) * technicalStepMs);
}

function sortTimes(times: DisplayReservationTime[]): DisplayReservationTime[] {
  return [...times].sort(
    (timeA, timeB) =>
      new Date(timeA.startAt).getTime() - new Date(timeB.startAt).getTime(),
  );
}

function addUniqueTime(
  selectedTimes: DisplayReservationTime[],
  time: DisplayReservationTime,
) {
  if (
    !selectedTimes.some((selectedTime) => selectedTime.startAt === time.startAt)
  ) {
    selectedTimes.push(time);
  }
}

function overlapsSlot({
  booking,
  slot,
}: {
  booking: DisplayBlockingBooking;
  slot: DisplayAvailabilitySlot;
}): boolean {
  return booking.startAt.getTime() < slot.endAt.getTime() &&
    booking.endAt.getTime() > slot.startAt.getTime();
}

function buildFreeBlocks({
  blockingBookings,
  now,
  slot,
}: {
  blockingBookings: DisplayBlockingBooking[];
  now: Date;
  slot: DisplayAvailabilitySlot;
}): FreeBlock[] {
  const blocks: FreeBlock[] = [];
  const sortedBookings = blockingBookings
    .filter((booking) => overlapsSlot({ booking, slot }))
    .sort(
      (bookingA, bookingB) =>
        bookingA.startAt.getTime() - bookingB.startAt.getTime(),
    );
  let cursor = new Date(Math.max(slot.startAt.getTime(), now.getTime()));
  let leftBoundary: BoundaryKind =
    cursor.getTime() > slot.startAt.getTime() ? "now" : "availability";

  for (const booking of sortedBookings) {
    const bookingStart = new Date(
      Math.max(booking.startAt.getTime(), slot.startAt.getTime()),
    );
    const bookingEnd = new Date(
      Math.min(booking.endAt.getTime(), slot.endAt.getTime()),
    );

    if (bookingEnd.getTime() <= cursor.getTime()) {
      continue;
    }

    if (bookingStart.getTime() > cursor.getTime()) {
      blocks.push({
        availabilitySlotId: slot.id,
        endAt: bookingStart,
        leftBoundary,
        rightBoundary: "booking",
        startAt: cursor,
      });
    }

    cursor = new Date(Math.max(cursor.getTime(), bookingEnd.getTime()));
    leftBoundary = "booking";
  }

  if (cursor.getTime() < slot.endAt.getTime()) {
    blocks.push({
      availabilitySlotId: slot.id,
      endAt: slot.endAt,
      leftBoundary,
      rightBoundary: "availability",
      startAt: cursor,
    });
  }

  return blocks;
}

function createCandidate({
  block,
  durationMinutes,
  edge,
  startAt,
}: {
  block: FreeBlock;
  durationMinutes: number;
  edge: "start" | "end";
  startAt: Date;
}): BlockEdgeCandidate {
  const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);
  const leftGapMs = startAt.getTime() - block.startAt.getTime();
  const rightGapMs = block.endAt.getTime() - endAt.getTime();
  const touchesBooking =
    (block.leftBoundary === "booking" &&
      startAt.getTime() === block.startAt.getTime()) ||
    (block.rightBoundary === "booking" &&
      endAt.getTime() === block.endAt.getTime());

  return {
    edge,
    hasThirtyMinuteGap:
      leftGapMs === thirtyMinutesMs || rightGapMs === thirtyMinutesMs,
    time: {
      availabilitySlotId: block.availabilitySlotId,
      durationMinutes,
      endAt: endAt.toISOString(),
      startAt: startAt.toISOString(),
    },
    touchesBooking,
  };
}

function buildBlockEdgeCandidates({
  block,
  durationMinutes,
}: {
  block: FreeBlock;
  durationMinutes: number;
}): BlockEdgeCandidate[] {
  const durationMs = durationMinutes * 60_000;
  const firstStartAt = ceilToStep(block.startAt);
  const lastStartAt = floorToStep(new Date(block.endAt.getTime() - durationMs));

  if (
    firstStartAt.getTime() + durationMs > block.endAt.getTime() ||
    lastStartAt.getTime() < firstStartAt.getTime()
  ) {
    return [];
  }

  const candidates = [
    createCandidate({
      block,
      durationMinutes,
      edge: "start",
      startAt: firstStartAt,
    }),
  ];

  if (lastStartAt.getTime() !== firstStartAt.getTime()) {
    candidates.push(
      createCandidate({
        block,
        durationMinutes,
        edge: "end",
        startAt: lastStartAt,
      }),
    );
  }

  return candidates;
}

function removeDominatedThirtyMinuteGaps(
  candidates: BlockEdgeCandidate[],
): BlockEdgeCandidate[] {
  const hasEndTouchingBooking = candidates.some(
    (candidate) => candidate.edge === "end" && candidate.touchesBooking,
  );

  if (!hasEndTouchingBooking) {
    return candidates;
  }

  return candidates.filter(
    (candidate) =>
      candidate.edge !== "start" ||
      candidate.touchesBooking ||
      !candidate.hasThirtyMinuteGap,
  );
}

function sortCandidatesByPriority(
  candidates: DisplayTimeCandidate[],
): DisplayTimeCandidate[] {
  return [...candidates].sort((candidateA, candidateB) => {
    const bookingRankA = candidateA.touchesBooking ? 0 : 1;
    const bookingRankB = candidateB.touchesBooking ? 0 : 1;
    const gapRankA = candidateA.hasThirtyMinuteGap ? 1 : 0;
    const gapRankB = candidateB.hasThirtyMinuteGap ? 1 : 0;

    return (
      bookingRankA - bookingRankB ||
      gapRankA - gapRankB ||
      new Date(candidateA.time.startAt).getTime() -
        new Date(candidateB.time.startAt).getTime()
    );
  });
}

function isMorningTime(time: DisplayReservationTime): boolean {
  return getParisTimeKey(time.startAt) < "12:00";
}

function limitCandidates(
  candidates: DisplayTimeCandidate[],
  limit: number,
): DisplayReservationTime[] {
  const selectedTimes: DisplayReservationTime[] = [];
  const priorityCandidates = sortCandidatesByPriority(candidates);
  const hasMorningCandidate = priorityCandidates.some((candidate) =>
    isMorningTime(candidate.time),
  );
  const hasAfternoonCandidate = priorityCandidates.some(
    (candidate) => !isMorningTime(candidate.time),
  );

  if (hasMorningCandidate && hasAfternoonCandidate && limit >= 2) {
    const morningCandidate = priorityCandidates.find((candidate) =>
      isMorningTime(candidate.time),
    );
    const afternoonCandidate = priorityCandidates.find(
      (candidate) => !isMorningTime(candidate.time),
    );

    if (morningCandidate) {
      addUniqueTime(selectedTimes, morningCandidate.time);
    }

    if (afternoonCandidate) {
      addUniqueTime(selectedTimes, afternoonCandidate.time);
    }
  }

  for (const candidate of priorityCandidates) {
    if (selectedTimes.length >= limit) {
      break;
    }

    addUniqueTime(selectedTimes, candidate.time);
  }

  return sortTimes(selectedTimes);
}

export function selectDisplayTimesForDay(
  candidates: DisplayTimeCandidate[],
  limit = maxTimesPerDay,
): DisplayReservationTime[] {
  if (candidates.length <= limit) {
    return sortTimes(candidates.map((candidate) => candidate.time));
  }

  return limitCandidates(candidates, limit);
}

export function buildDisplayReservationTimes({
  availabilitySlots,
  blockingBookings,
  durationMinutes,
  now = new Date(),
}: {
  availabilitySlots: DisplayAvailabilitySlot[];
  blockingBookings: DisplayBlockingBooking[];
  durationMinutes: number;
  now?: Date;
}): DisplayReservationTime[] {
  const candidatesByDate = availabilitySlots.reduce<
    Record<string, DisplayTimeCandidate[]>
  >((groupedCandidates, slot) => {
    const freeBlocks = buildFreeBlocks({ blockingBookings, now, slot });
    const slotCandidates = freeBlocks.flatMap((block) =>
      removeDominatedThirtyMinuteGaps(
        buildBlockEdgeCandidates({ block, durationMinutes }),
      ),
    );

    for (const candidate of slotCandidates) {
      const dateKey = getParisDateKey(candidate.time.startAt);

      groupedCandidates[dateKey] = [
        ...(groupedCandidates[dateKey] ?? []),
        candidate,
      ];
    }

    return groupedCandidates;
  }, {});

  return sortTimes(
    Object.values(candidatesByDate).flatMap((candidates) =>
      selectDisplayTimesForDay(candidates),
    ),
  );
}

export function buildDisplayReservationCalendar(
  availableTimes: DisplayReservationTime[],
): DisplayReservationCalendar {
  const timesByDate = sortTimes(availableTimes).reduce<
    Record<string, DisplayReservationTime[]>
  >((groupedTimes, time) => {
    const dateKey = getParisDateKey(time.startAt);

    return {
      ...groupedTimes,
      [dateKey]: [...(groupedTimes[dateKey] ?? []), time],
    };
  }, {});
  const days = Object.entries(timesByDate)
    .map(([dateKey, times]) => ({
      dateKey,
      times: sortTimes(times),
    }))
    .filter((day) => day.times.length > 0)
    .sort((dayA, dayB) => dayA.dateKey.localeCompare(dayB.dateKey));
  const monthsByKey = days.reduce<Record<string, DisplayReservationMonth>>(
    (groupedMonths, day) => {
      const monthKey = day.dateKey.slice(0, 7);
      const month = groupedMonths[monthKey] ?? {
        days: [],
        monthKey,
      };

      return {
        ...groupedMonths,
        [monthKey]: {
          ...month,
          days: [...month.days, day],
        },
      };
    },
    {},
  );

  return {
    months: Object.values(monthsByKey).sort((monthA, monthB) =>
      monthA.monthKey.localeCompare(monthB.monthKey),
    ),
    monthsByKey,
  };
}

export function getNextMonthWithAvailability(
  calendar: DisplayReservationCalendar,
  fromMonthKey: string,
): string {
  return (
    calendar.months.find((month) => month.monthKey >= fromMonthKey)?.monthKey ??
    calendar.months[0]?.monthKey ??
    fromMonthKey
  );
}
