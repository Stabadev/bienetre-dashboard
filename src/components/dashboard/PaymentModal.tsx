"use client";

import { useState } from "react";
import type { CalendarEvent } from "@/lib/calendar";
import { formatDate, formatTime } from "./formatters";
import type { PaymentDraft, PaymentMethod, SavedPayment } from "./types";

const paymentMethods: PaymentMethod[] = [
  "espèces",
  "chèque",
  "virement",
  "carte",
];

type PaymentModalProps = {
  event: CalendarEvent;
  existingPayment?: SavedPayment;
  errorMessage?: string;
  isSaving: boolean;
  onClose: () => void;
  onValidate: (payment: PaymentDraft) => void;
};

export function PaymentModal({
  event,
  errorMessage,
  existingPayment,
  isSaving,
  onClose,
  onValidate,
}: PaymentModalProps) {
  const [amount, setAmount] = useState(existingPayment?.amount.toString() ?? "");
  const [method, setMethod] = useState<PaymentMethod>(
    existingPayment?.method ?? "espèces",
  );

  const parsedAmount = Number(amount);
  const canValidate =
    amount !== "" && Number.isInteger(parsedAmount) && parsedAmount > 0;

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6"
      role="dialog"
    >
      <div className="flex max-h-[calc(100vh-24px)] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-xl sm:max-h-[calc(100vh-48px)]">
        <div className="border-b border-zinc-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Renseigner un paiement</h2>
              <p className="mt-1 text-sm text-zinc-600">{event.title}</p>
            </div>
            <button
              aria-label="Fermer"
              className="rounded-md px-2 py-1 text-xl leading-none text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              onClick={onClose}
              type="button"
            >
              ×
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          <dl className="grid gap-3 rounded-lg bg-zinc-50 p-4 text-sm sm:grid-cols-3">
            <div className="sm:col-span-3">
              <dt className="text-zinc-500">Date</dt>
              <dd className="font-medium">{formatDate(event.startAt)}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Début</dt>
              <dd className="font-medium">{formatTime(event.startAt)}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Fin</dt>
              <dd className="font-medium">{formatTime(event.endAt)}</dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-col gap-5">
            <label className="flex flex-col gap-2 text-sm font-medium">
              Montant
              <input
                className="h-11 rounded-lg border border-zinc-300 px-3 text-base outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                inputMode="decimal"
                min="0"
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0"
                step="1"
                type="number"
                value={amount}
              />
            </label>

            <fieldset>
              <legend className="text-sm font-medium">Mode de paiement</legend>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {paymentMethods.map((paymentMethod) => (
                  <label
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 px-3 py-3 text-sm has-[:checked]:border-zinc-900 has-[:checked]:bg-zinc-950 has-[:checked]:text-white"
                    key={paymentMethod}
                  >
                    <input
                      checked={method === paymentMethod}
                      className="sr-only"
                      name="paymentMethod"
                      onChange={() => setMethod(paymentMethod)}
                      type="radio"
                    />
                    {paymentMethod}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          {errorMessage ? (
            <p className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-zinc-200 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            className="h-11 rounded-lg border border-zinc-300 px-4 font-medium text-zinc-700 hover:bg-zinc-50"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            Annuler
          </button>
          <button
            className="h-11 rounded-lg bg-zinc-950 px-4 font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
            disabled={!canValidate || isSaving}
            onClick={() => onValidate({ amount: parsedAmount, method })}
            type="button"
          >
            {isSaving ? "Enregistrement..." : "Valider"}
          </button>
        </div>
      </div>
    </div>
  );
}
