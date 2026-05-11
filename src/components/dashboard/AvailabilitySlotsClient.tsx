"use client";

import { PointerEvent, useMemo, useState } from "react";
import { formatDate, formatTime } from "./formatters";

export type AvailabilitySlotView = {
  id: string;
  startAt: string;
  endAt: string;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type AvailabilitySlotsClientProps = {
  initialSlots: AvailabilitySlotView[];
};

type DraftSelection = {
  dayIndex: number;
  endStep: number;
  startStep: number;
};

const weekDayIndexes = [1, 2, 3, 4, 5, 6];
const dayStartHour = 6;
const dayEndHour = 20;
const stepMinutes = 30;
const stepsPerHour = 60 / stepMinutes;
const totalSteps = (dayEndHour - dayStartHour) * stepsPerHour;
const rowHeightPx = 28;
const calendarGridTemplateColumns = "4.5rem repeat(6, minmax(8.5rem, 1fr))";
const calendarHeightPx = totalSteps * rowHeightPx;
const parisDateKeyFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Europe/Paris",
  year: "numeric",
});

function startOfWeek(value: Date): Date {
  const date = new Date(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);

  return date;
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);

  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

function dateKey(date: Date): string {
  const parts = parisDateKeyFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function getDateTimeForStep(day: Date, step: number): Date {
  const date = new Date(day);
  const minutesFromStart = step * stepMinutes;

  date.setHours(dayStartHour, minutesFromStart, 0, 0);

  return date;
}

function getStepFromDate(value: string): number {
  const date = new Date(value);
  const minutes = date.getHours() * 60 + date.getMinutes();

  return Math.round((minutes - dayStartHour * 60) / stepMinutes);
}

function getWeekTitle(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 5);

  return `${formatDate(weekStart.toISOString())} - ${formatDate(
    weekEnd.toISOString(),
  )}`;
}

function getDayLabel(day: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    weekday: "short",
  }).format(day);
}

function sortSlots(slots: AvailabilitySlotView[]): AvailabilitySlotView[] {
  return [...slots].sort(
    (slotA, slotB) =>
      new Date(slotA.startAt).getTime() - new Date(slotB.startAt).getTime(),
  );
}

function normalizeSelection(selection: DraftSelection): DraftSelection {
  return {
    dayIndex: selection.dayIndex,
    endStep: Math.max(selection.startStep, selection.endStep) + 1,
    startStep: Math.min(selection.startStep, selection.endStep),
  };
}

async function readErrorMessage(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  return payload?.error ?? "La requête a échoué.";
}

export function AvailabilitySlotsClient({
  initialSlots,
}: AvailabilitySlotsClientProps) {
  const [slots, setSlots] = useState(sortSlots(initialSlots));
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [draftSelection, setDraftSelection] = useState<DraftSelection | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [deletingSlotId, setDeletingSlotId] = useState<string>();
  const [isCopyingWeek, setIsCopyingWeek] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>();
  const weekDays = useMemo(
    () => weekDayIndexes.map((dayOffset) => addDays(weekStart, dayOffset - 1)),
    [weekStart],
  );
  const visibleSlots = useMemo(() => {
    const visibleKeys = new Set(weekDays.map(dateKey));

    return slots.filter((slot) => visibleKeys.has(dateKey(new Date(slot.startAt))));
  }, [slots, weekDays]);

  async function createSlot({
    endAt,
    notes = null,
    startAt,
  }: {
    endAt: Date;
    notes?: string | null;
    startAt: Date;
  }) {
    setIsSaving(true);
    setErrorMessage(undefined);
    setSuccessMessage(undefined);

    try {
      const response = await fetch("/api/availability-slots", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          endAt: endAt.toISOString(),
          notes,
          startAt: startAt.toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const createdSlot = (await response.json()) as AvailabilitySlotView;

      setSlots((currentSlots) => sortSlots([...currentSlots, createdSlot]));

      return createdSlot;
    } finally {
      setIsSaving(false);
    }
  }

  async function createSlotFromSelection(selection: DraftSelection) {
    const normalizedSelection = normalizeSelection(selection);
    const day = weekDays[normalizedSelection.dayIndex];
    const startAt = getDateTimeForStep(day, normalizedSelection.startStep);
    const endAt = getDateTimeForStep(day, normalizedSelection.endStep);

    if (endAt.getTime() <= startAt.getTime()) {
      return;
    }

    try {
      await createSlot({ endAt, startAt });
      setSuccessMessage("Plage de disponibilité ajoutée.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de créer la plage de disponibilité.",
      );
    }
  }

  async function deleteSlot(slotId: string) {
    const confirmed = window.confirm("Supprimer cette plage de disponibilité ?");

    if (!confirmed) {
      return;
    }

    setDeletingSlotId(slotId);
    setErrorMessage(undefined);
    setSuccessMessage(undefined);

    try {
      const response = await fetch(
        `/api/availability-slots/${encodeURIComponent(slotId)}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      setSlots((currentSlots) =>
        currentSlots.filter((slot) => slot.id !== slotId),
      );
      setSuccessMessage("Plage de disponibilité supprimée.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de supprimer la plage de disponibilité.",
      );
    } finally {
      setDeletingSlotId(undefined);
    }
  }

  async function copyWeekToNextWeek() {
    const confirmed = window.confirm(
      "Copier toutes les plages visibles vers la semaine suivante ?",
    );

    if (!confirmed || visibleSlots.length === 0) {
      return;
    }

    setIsCopyingWeek(true);
    setErrorMessage(undefined);
    setSuccessMessage(undefined);

    try {
      const createdSlots = await Promise.all(
        visibleSlots.map((slot) =>
          createSlot({
            endAt: addWeeks(new Date(slot.endAt), 1),
            notes: slot.notes,
            startAt: addWeeks(new Date(slot.startAt), 1),
          }),
        ),
      );

      setSuccessMessage(
        `${createdSlots.length} plage${
          createdSlots.length > 1 ? "s" : ""
        } copiée${createdSlots.length > 1 ? "s" : ""}.`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de copier la semaine.",
      );
    } finally {
      setIsCopyingWeek(false);
    }
  }

  function startSelection(dayIndex: number, step: number) {
    if (isSaving) {
      return;
    }

    setDraftSelection({
      dayIndex,
      endStep: step,
      startStep: step,
    });
    setErrorMessage(undefined);
    setSuccessMessage(undefined);
  }

  function updateSelection(dayIndex: number, step: number) {
    setDraftSelection((selection) => {
      if (!selection || selection.dayIndex !== dayIndex) {
        return selection;
      }

      return {
        ...selection,
        endStep: step,
      };
    });
  }

  async function finishSelection() {
    const selection = draftSelection;

    setDraftSelection(null);

    if (selection) {
      await createSlotFromSelection(selection);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Calendrier hebdomadaire</h2>
            <p className="mt-1 text-sm text-zinc-600">{getWeekTitle(weekStart)}</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-amber-300"
              onClick={() => setWeekStart((current) => addWeeks(current, -1))}
              type="button"
            >
              Semaine précédente
            </button>
            <button
              className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-amber-300"
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              type="button"
            >
              Aujourd&apos;hui
            </button>
            <button
              className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-amber-300"
              onClick={() => setWeekStart((current) => addWeeks(current, 1))}
              type="button"
            >
              Semaine suivante
            </button>
            <button
              className="h-10 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
              disabled={isCopyingWeek || visibleSlots.length === 0}
              onClick={copyWeekToNextWeek}
              type="button"
            >
              {isCopyingWeek ? "Copie..." : "Copier vers semaine suivante"}
            </button>
          </div>
        </div>

        {errorMessage ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        {successMessage ? (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            {successMessage}
          </p>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[960px] overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <div
              className="grid"
              style={{ gridTemplateColumns: calendarGridTemplateColumns }}
            >
              <div className="border-b border-zinc-200 bg-zinc-50" />
              {weekDays.map((day) => (
                <div
                  className="border-b border-l border-zinc-200 bg-zinc-50 px-3 py-2 text-center text-sm font-semibold text-zinc-800"
                  key={dateKey(day)}
                >
                  {getDayLabel(day)}
                </div>
              ))}
            </div>

            <div
              className="grid"
              style={{ gridTemplateColumns: calendarGridTemplateColumns }}
            >
              <div
                className="border-r border-zinc-200 bg-zinc-50"
                style={{ height: calendarHeightPx }}
              >
                {Array.from({ length: totalSteps }).map((_, step) => (
                  <div
                    className="border-b border-zinc-100 pr-2 text-right text-xs text-zinc-500"
                    key={step}
                    style={{ height: rowHeightPx }}
                  >
                    {step % stepsPerHour === 0
                      ? `${String(dayStartHour + step / stepsPerHour).padStart(
                          2,
                          "0",
                        )}:00`
                      : ""}
                  </div>
                ))}
              </div>

              {weekDays.map((day, dayIndex) => (
                <DayColumn
                  dayIndex={dayIndex}
                  deletingSlotId={deletingSlotId}
                  draftSelection={draftSelection}
                  key={dateKey(day)}
                  onDeleteSlot={deleteSlot}
                  onFinishSelection={finishSelection}
                  onStartSelection={startSelection}
                  onUpdateSelection={updateSelection}
                  slots={visibleSlots.filter(
                    (slot) => dateKey(new Date(slot.startAt)) === dateKey(day),
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm text-zinc-600">
          Glissez sur une colonne pour créer une plage. Les horaires sont
          arrondis par pas de 30 minutes, de 06:00 à 20:00.
        </p>
      </section>
    </div>
  );
}

function DayColumn({
  dayIndex,
  deletingSlotId,
  draftSelection,
  onDeleteSlot,
  onFinishSelection,
  onStartSelection,
  onUpdateSelection,
  slots,
}: {
  dayIndex: number;
  deletingSlotId?: string;
  draftSelection: DraftSelection | null;
  onDeleteSlot: (slotId: string) => void;
  onFinishSelection: () => void;
  onStartSelection: (dayIndex: number, step: number) => void;
  onUpdateSelection: (dayIndex: number, step: number) => void;
  slots: AvailabilitySlotView[];
}) {
  const normalizedDraft =
    draftSelection && draftSelection.dayIndex === dayIndex
      ? normalizeSelection(draftSelection)
      : null;

  function getStepFromPointer(event: PointerEvent<HTMLDivElement>): number {
    const rect = event.currentTarget.getBoundingClientRect();
    const y = Math.max(0, Math.min(rect.height - 1, event.clientY - rect.top));

    return Math.min(totalSteps - 1, Math.floor(y / rowHeightPx));
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    onStartSelection(dayIndex, getStepFromPointer(event));
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!draftSelection || draftSelection.dayIndex !== dayIndex) {
      return;
    }

    onUpdateSelection(dayIndex, getStepFromPointer(event));
  }

  return (
    <div
      className="relative border-l border-zinc-200 bg-white"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={onFinishSelection}
      role="presentation"
      style={{ height: calendarHeightPx }}
    >
      {Array.from({ length: totalSteps }).map((_, step) => (
        <div
          className="pointer-events-none border-b border-zinc-100"
          key={step}
          style={{ height: rowHeightPx }}
        />
      ))}

      {normalizedDraft ? (
        <div
          className="pointer-events-none absolute left-1 right-1 rounded-lg border border-amber-500 bg-amber-200/70"
          style={{
            height:
              (normalizedDraft.endStep - normalizedDraft.startStep) *
              rowHeightPx,
            top: normalizedDraft.startStep * rowHeightPx,
          }}
        />
      ) : null}

      {slots.map((slot) => {
        const startStep = Math.max(0, getStepFromDate(slot.startAt));
        const endStep = Math.min(totalSteps, getStepFromDate(slot.endAt));
        const top = startStep * rowHeightPx;
        const height = Math.max(rowHeightPx, (endStep - startStep) * rowHeightPx);

        return (
          <article
            className="absolute left-1 right-1 overflow-hidden rounded-lg border border-emerald-300 bg-emerald-100 px-2 py-1 text-xs shadow-sm"
            key={slot.id}
            onPointerDown={(event) => event.stopPropagation()}
            style={{ height, top }}
          >
            <p className="font-semibold text-emerald-950">
              {formatTime(slot.startAt)} - {formatTime(slot.endAt)}
            </p>
            {slot.notes ? (
              <p className="mt-0.5 truncate text-emerald-800">{slot.notes}</p>
            ) : null}
            <button
              className="mt-1 rounded-md bg-white/80 px-2 py-0.5 font-medium text-red-700 hover:bg-white disabled:text-zinc-300"
              disabled={deletingSlotId === slot.id}
              onClick={() => onDeleteSlot(slot.id)}
              type="button"
            >
              {deletingSlotId === slot.id ? "..." : "Supprimer"}
            </button>
          </article>
        );
      })}
    </div>
  );
}
