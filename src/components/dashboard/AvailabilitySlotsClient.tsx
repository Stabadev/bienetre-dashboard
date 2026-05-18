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

type DraggedSlot = {
  currentEndStep: number;
  currentStartStep: number;
  didMove: boolean;
  originalEndStep: number;
  originalStartStep: number;
  originClientY: number;
  pointerId: number;
  slotId: string;
};

const weekDayIndexes = [1, 2, 3, 4, 5, 6];
const dayStartHour = 6;
const dayEndHour = 20;
const stepMinutes = 15;
const stepsPerHour = 60 / stepMinutes;
const totalSteps = (dayEndHour - dayStartHour) * stepsPerHour;
const rowHeightPx = 14;
const dragClickThresholdPx = 4;
const calendarGridTemplateColumns = "4.5rem repeat(6, minmax(8.5rem, 1fr))";
const calendarHeightPx = totalSteps * rowHeightPx;
const timeOptions = Array.from({ length: totalSteps + 1 }).map((_, step) => {
  const minutes = dayStartHour * 60 + step * stepMinutes;
  const hoursPart = Math.floor(minutes / 60);
  const minutesPart = minutes % 60;

  return {
    label: `${String(hoursPart).padStart(2, "0")}:${String(
      minutesPart,
    ).padStart(2, "0")}`,
    value: minutes,
  };
});
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

function getMinutesOfDay(value: string): number {
  const date = new Date(value);

  return date.getHours() * 60 + date.getMinutes();
}

function getDateTimeForMinutes(baseValue: string, minutesOfDay: number): Date {
  const date = new Date(baseValue);

  date.setHours(Math.floor(minutesOfDay / 60), minutesOfDay % 60, 0, 0);

  return date;
}

function getQuickTimeOptions(currentMinutes: number) {
  const quickValues = [-30, -15, 0, 15, 30]
    .map((offset) => currentMinutes + offset)
    .filter(
      (minutes) =>
        minutes >= dayStartHour * 60 && minutes <= dayEndHour * 60,
    );

  return timeOptions.filter((option) => quickValues.includes(option.value));
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
  const [editingSlot, setEditingSlot] = useState<AvailabilitySlotView | null>(
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

  async function updateSlot({
    endAt,
    slotId,
    startAt,
  }: {
    endAt: Date;
    slotId: string;
    startAt: Date;
  }) {
    setIsSaving(true);
    setErrorMessage(undefined);
    setSuccessMessage(undefined);

    try {
      const response = await fetch(
        `/api/availability-slots/${encodeURIComponent(slotId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            endAt: endAt.toISOString(),
            startAt: startAt.toISOString(),
          }),
        },
      );

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const updatedSlot = (await response.json()) as AvailabilitySlotView;

      setSlots((currentSlots) =>
        sortSlots(
          currentSlots.map((slot) =>
            slot.id === updatedSlot.id ? updatedSlot : slot,
          ),
        ),
      );
      setEditingSlot(null);
      setSuccessMessage("Plage de disponibilité modifiée.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de modifier la plage de disponibilité.",
      );
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
      setEditingSlot((currentSlot) =>
        currentSlot?.id === slotId ? null : currentSlot,
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

  async function copyWeekToFutureWeek(weekOffset: 1 | 2) {
    const targetLabel = `N+${weekOffset}`;
    const confirmed = window.confirm(
      `Copier toutes les plages visibles vers la semaine ${targetLabel} ?`,
    );

    if (!confirmed || visibleSlots.length === 0) {
      return;
    }

    const targetWeekKeys = new Set(
      weekDays.map((day) => dateKey(addWeeks(day, weekOffset))),
    );
    const targetWeekHasActiveSlots = slots.some(
      (slot) =>
        slot.isActive && targetWeekKeys.has(dateKey(new Date(slot.startAt))),
    );

    if (targetWeekHasActiveSlots) {
      setErrorMessage(
        `La semaine ${targetLabel} contient déjà des disponibilités. Copie annulée pour éviter les doublons.`,
      );
      setSuccessMessage(undefined);

      return;
    }

    setIsCopyingWeek(true);
    setErrorMessage(undefined);
    setSuccessMessage(undefined);

    try {
      const createdSlots = await Promise.all(
        visibleSlots.map((slot) =>
          createSlot({
            endAt: addWeeks(new Date(slot.endAt), weekOffset),
            notes: slot.notes,
            startAt: addWeeks(new Date(slot.startAt), weekOffset),
          }),
        ),
      );

      setSuccessMessage(
        `${createdSlots.length} plage${
          createdSlots.length > 1 ? "s" : ""
        } copiée${createdSlots.length > 1 ? "s" : ""} vers la semaine ${targetLabel}.`,
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
              onClick={() => copyWeekToFutureWeek(1)}
              type="button"
            >
              {isCopyingWeek ? "Copie..." : "Copier vers semaine N+1"}
            </button>
            <button
              className="h-10 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
              disabled={isCopyingWeek || visibleSlots.length === 0}
              onClick={() => copyWeekToFutureWeek(2)}
              type="button"
            >
              {isCopyingWeek ? "Copie..." : "Copier vers semaine N+2"}
            </button>
          </div>
        </div>

        {errorMessage || successMessage ? (
          <div className="fixed right-4 top-4 z-50 max-w-sm sm:right-6 sm:top-6">
            {errorMessage ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 shadow-lg">
                {errorMessage}
              </p>
            ) : (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 shadow-lg">
                {successMessage}
              </p>
            )}
          </div>
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
                    className={`pr-2 text-right text-[11px] leading-none ${
                      step % stepsPerHour === 0
                        ? "border-t-2 border-zinc-800 pt-0.5 font-semibold text-zinc-950"
                        : "border-t border-zinc-100 text-zinc-400"
                    }`}
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
                  onEditSlot={setEditingSlot}
                  onFinishSelection={finishSelection}
                  onMoveSlot={(slot, startAt, endAt) =>
                    updateSlot({
                      endAt,
                      slotId: slot.id,
                      startAt,
                    })
                  }
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
          arrondis par pas de 15 minutes, de 06:00 à 20:00.
        </p>
      </section>

      {editingSlot ? (
        <EditAvailabilitySlotModal
          isDeleting={deletingSlotId === editingSlot.id}
          isSaving={isSaving}
          onCancel={() => setEditingSlot(null)}
          onDelete={() => deleteSlot(editingSlot.id)}
          onSave={({ endAt, startAt }) =>
            updateSlot({
              endAt,
              slotId: editingSlot.id,
              startAt,
            })
          }
          slot={editingSlot}
        />
      ) : null}
    </div>
  );
}

function DayColumn({
  dayIndex,
  deletingSlotId,
  draftSelection,
  onDeleteSlot,
  onEditSlot,
  onFinishSelection,
  onMoveSlot,
  onStartSelection,
  onUpdateSelection,
  slots,
}: {
  dayIndex: number;
  deletingSlotId?: string;
  draftSelection: DraftSelection | null;
  onDeleteSlot: (slotId: string) => void;
  onEditSlot: (slot: AvailabilitySlotView) => void;
  onFinishSelection: () => void;
  onMoveSlot: (
    slot: AvailabilitySlotView,
    startAt: Date,
    endAt: Date,
  ) => void | Promise<void>;
  onStartSelection: (dayIndex: number, step: number) => void;
  onUpdateSelection: (dayIndex: number, step: number) => void;
  slots: AvailabilitySlotView[];
}) {
  const [draggedSlot, setDraggedSlot] = useState<DraggedSlot | null>(null);
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

  function handleSlotPointerDown({
    endStep,
    event,
    slot,
    startStep,
  }: {
    endStep: number;
    event: PointerEvent<HTMLElement>;
    slot: AvailabilitySlotView;
    startStep: number;
  }) {
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggedSlot({
      currentEndStep: endStep,
      currentStartStep: startStep,
      didMove: false,
      originalEndStep: endStep,
      originalStartStep: startStep,
      originClientY: event.clientY,
      pointerId: event.pointerId,
      slotId: slot.id,
    });
  }

  function handleSlotPointerMove(event: PointerEvent<HTMLElement>) {
    setDraggedSlot((currentDrag) => {
      if (!currentDrag || currentDrag.pointerId !== event.pointerId) {
        return currentDrag;
      }

      const deltaY = event.clientY - currentDrag.originClientY;
      const durationSteps =
        currentDrag.originalEndStep - currentDrag.originalStartStep;
      const nextStartStep = Math.min(
        totalSteps - durationSteps,
        Math.max(
          0,
          currentDrag.originalStartStep + Math.round(deltaY / rowHeightPx),
        ),
      );

      return {
        ...currentDrag,
        currentEndStep: nextStartStep + durationSteps,
        currentStartStep: nextStartStep,
        didMove:
          currentDrag.didMove || Math.abs(deltaY) >= dragClickThresholdPx,
      };
    });
  }

  async function handleSlotPointerUp({
    event,
    slot,
  }: {
    event: PointerEvent<HTMLElement>;
    slot: AvailabilitySlotView;
  }) {
    event.stopPropagation();

    const currentDrag = draggedSlot;

    if (!currentDrag || currentDrag.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const changedStep =
      currentDrag.currentStartStep !== currentDrag.originalStartStep;

    if (!currentDrag.didMove || !changedStep) {
      setDraggedSlot(null);
      onEditSlot(slot);

      return;
    }

    await onMoveSlot(
      slot,
      getDateTimeForStep(new Date(slot.startAt), currentDrag.currentStartStep),
      getDateTimeForStep(new Date(slot.endAt), currentDrag.currentEndStep),
    );
    setDraggedSlot(null);
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
          className={`pointer-events-none ${
            step % stepsPerHour === 0
              ? "border-t-2 border-zinc-800"
              : "border-t border-zinc-100"
          }`}
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
        const displayedStartStep =
          draggedSlot?.slotId === slot.id
            ? draggedSlot.currentStartStep
            : startStep;
        const displayedEndStep =
          draggedSlot?.slotId === slot.id ? draggedSlot.currentEndStep : endStep;
        const top = displayedStartStep * rowHeightPx;
        const height = Math.max(
          rowHeightPx,
          (displayedEndStep - displayedStartStep) * rowHeightPx,
        );
        const isDragging = draggedSlot?.slotId === slot.id && draggedSlot.didMove;

        return (
          <article
            className={`absolute left-1 right-1 cursor-grab select-none overflow-hidden rounded-lg border border-emerald-300 bg-emerald-100 px-2 py-1 text-xs shadow-sm transition hover:border-emerald-500 hover:bg-emerald-200 active:cursor-grabbing ${
              isDragging ? "z-20 opacity-90 ring-2 ring-emerald-500" : ""
            }`}
            key={slot.id}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onEditSlot(slot);
              }
            }}
            onPointerCancel={(event) => {
              event.stopPropagation();
              setDraggedSlot(null);
            }}
            onPointerDown={(event) =>
              handleSlotPointerDown({
                endStep,
                event,
                slot,
                startStep,
              })
            }
            onPointerMove={handleSlotPointerMove}
            onPointerUp={(event) => handleSlotPointerUp({ event, slot })}
            role="button"
            style={{ height, top }}
            tabIndex={0}
          >
            <p className="font-semibold text-emerald-950">
              {isDragging
                ? `${formatTime(
                    getDateTimeForStep(
                      new Date(slot.startAt),
                      displayedStartStep,
                    ).toISOString(),
                  )} - ${formatTime(
                    getDateTimeForStep(
                      new Date(slot.endAt),
                      displayedEndStep,
                    ).toISOString(),
                  )}`
                : `${formatTime(slot.startAt)} - ${formatTime(slot.endAt)}`}
            </p>
            {slot.notes ? (
              <p className="mt-0.5 truncate text-emerald-800">{slot.notes}</p>
            ) : null}
            <button
              className="mt-1 rounded-md bg-white/80 px-2 py-0.5 font-medium text-red-700 hover:bg-white disabled:text-zinc-300"
              disabled={deletingSlotId === slot.id}
              onClick={(event) => {
                event.stopPropagation();
                onDeleteSlot(slot.id);
              }}
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

function EditAvailabilitySlotModal({
  isDeleting,
  isSaving,
  onCancel,
  onDelete,
  onSave,
  slot,
}: {
  isDeleting: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onDelete: () => void | Promise<void>;
  onSave: ({
    endAt,
    startAt,
  }: {
    endAt: Date;
    startAt: Date;
  }) => void | Promise<void>;
  slot: AvailabilitySlotView;
}) {
  const initialStartMinutes = getMinutesOfDay(slot.startAt);
  const initialEndMinutes = getMinutesOfDay(slot.endAt);
  const [startMinutes, setStartMinutes] = useState(initialStartMinutes);
  const [endMinutes, setEndMinutes] = useState(initialEndMinutes);
  const [validationMessage, setValidationMessage] = useState<string>();
  const quickStartOptions = getQuickTimeOptions(initialStartMinutes);
  const quickEndOptions = getQuickTimeOptions(initialEndMinutes);

  async function handleSave() {
    if (endMinutes <= startMinutes) {
      setValidationMessage("L'heure de fin doit être après l'heure de début.");

      return;
    }

    setValidationMessage(undefined);

    await onSave({
      endAt: getDateTimeForMinutes(slot.endAt, endMinutes),
      startAt: getDateTimeForMinutes(slot.startAt, startMinutes),
    });
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 px-4 py-6"
      role="dialog"
    >
      <section className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-950">
              Modifier la disponibilité
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              {formatDate(slot.startAt)}
            </p>
          </div>
          <button
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            disabled={isSaving || isDeleting}
            onClick={onCancel}
            type="button"
          >
            Fermer
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <TimeField
            label="Début"
            onChange={setStartMinutes}
            quickOptions={quickStartOptions}
            value={startMinutes}
          />
          <TimeField
            label="Fin"
            onChange={setEndMinutes}
            quickOptions={quickEndOptions}
            value={endMinutes}
          />
        </div>

        {validationMessage ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {validationMessage}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            className="h-10 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-zinc-300"
            disabled={isSaving || isDeleting}
            onClick={onDelete}
            type="button"
          >
            {isDeleting ? "Suppression..." : "Supprimer"}
          </button>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-300"
              disabled={isSaving || isDeleting}
              onClick={onCancel}
              type="button"
            >
              Annuler
            </button>
            <button
              className="h-10 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
              disabled={isSaving || isDeleting}
              onClick={handleSave}
              type="button"
            >
              {isSaving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function TimeField({
  label,
  onChange,
  quickOptions,
  value,
}: {
  label: string;
  onChange: (value: number) => void;
  quickOptions: { label: string; value: number }[];
  value: number;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-zinc-800">
        {label}
        <select
          className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-950 shadow-sm"
          onChange={(event) => onChange(Number(event.target.value))}
          value={value}
        >
          {timeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        {quickOptions.map((option) => (
          <button
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
              option.value === value
                ? "border-amber-600 bg-amber-50 text-amber-800"
                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
