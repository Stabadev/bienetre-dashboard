"use client";

import { useEffect, useRef, useState } from "react";
import type { CalendarEvent } from "@/lib/calendar";
import {
  buildClientName,
  normalizeClientName,
  splitClientName,
} from "@/lib/client-name";
import { formatDate, formatTime } from "./formatters";
import type {
  PaymentDraft,
  PaymentMethod,
  SavedPayment,
} from "./types";

const paymentMethods: PaymentMethod[] = ["chèque", "espèces", "virement"];

const services: Array<{
  label: string;
  duration: string;
  description: string;
  price: number;
}> = [
  {
    label: "Première séance",
    duration: "1h20",
    description: "discussion, bilan énergétique, soin et conseils personnalisés",
    price: 75,
  },
  {
    label: "Séance de suite des soins",
    duration: "50min",
    description: "soins et suite de conseils",
    price: 60,
  },
];

function getInitialPaymentMethod(existingPayment?: SavedPayment): PaymentMethod {
  return (
    paymentMethods.find(
      (paymentMethod) => paymentMethod === existingPayment?.method,
    ) ?? "espèces"
  );
}

function getMatchingServiceLabel(serviceLabel: string): string | null {
  const normalizedService = serviceLabel.toLocaleLowerCase("fr-FR");

  if (normalizedService.includes("prem")) {
    return services[0].label;
  }

  if (
    normalizedService.includes("suite") ||
    normalizedService.includes("entretien") ||
    normalizedService.includes("suivi")
  ) {
    return services[1].label;
  }

  return null;
}

function getInitialService(
  event: CalendarEvent,
  existingPayment?: SavedPayment,
): string {
  return (
    existingPayment?.service ??
    getMatchingServiceLabel(event.title) ??
    event.title ??
    services[0].label
  );
}

function getDefaultAmountFromService(serviceLabel: string): string {
  const matchingService = services.find(
    (service) => service.label === getMatchingServiceLabel(serviceLabel),
  );

  return matchingService ? matchingService.price.toString() : "";
}

function getInitialAmount(
  serviceLabel: string,
  existingPayment?: SavedPayment,
): string {
  return (
    existingPayment?.amount.toString() ?? getDefaultAmountFromService(serviceLabel)
  );
}

function getServiceButtonLabel(serviceLabel: string): string {
  if (serviceLabel === "Séance de suite des soins") {
    return "Séance de suite";
  }

  return serviceLabel;
}

function getInitialClientName(
  event: CalendarEvent,
  existingPayment?: SavedPayment,
): string {
  return (
    normalizeClientName(existingPayment?.clientName) ||
    buildClientName({
      clientFirstName: existingPayment?.clientFirstName,
      clientLastName: existingPayment?.clientLastName,
    }) ||
    normalizeClientName(event.clientName) ||
    buildClientName({
      clientFirstName: event.clientFirstName,
      clientLastName: event.clientLastName,
    })
  );
}

function getContactDisplay(email: string, phone: string): string {
  return `${email} • ${phone}`;
}

type PaymentModalProps = {
  event: CalendarEvent;
  existingPayment?: SavedPayment;
  errorMessage?: string;
  isSaving: boolean;
  isDeleting: boolean;
  onClose: () => void;
  onDelete: () => void;
  onValidate: (payment: PaymentDraft) => void;
};

export function PaymentModal({
  event,
  errorMessage,
  existingPayment,
  isDeleting,
  isSaving,
  onClose,
  onDelete,
  onValidate,
}: PaymentModalProps) {
  const clientEmail = event.clientEmail ?? "Email non renseigné";
  const clientPhone = event.clientPhone ?? "Téléphone non renseigné";
  const contactDisplay = getContactDisplay(clientEmail, clientPhone);
  const isEditing = existingPayment !== undefined;
  const initialService = getInitialService(event, existingPayment);
  const [clientName, setClientName] = useState(
    getInitialClientName(event, existingPayment),
  );
  const [service, setService] = useState(initialService);
  const [amount, setAmount] = useState(
    getInitialAmount(initialService, existingPayment),
  );
  const [method, setMethod] = useState<PaymentMethod>(
    getInitialPaymentMethod(existingPayment),
  );
  const isSubmittingRef = useRef(false);
  const [submittingMethod, setSubmittingMethod] = useState<
    PaymentMethod | undefined
  >();

  const parsedAmount = Number(amount);
  const canValidate =
    amount !== "" && Number.isInteger(parsedAmount) && parsedAmount > 0;
  const selectedServiceLabel = getMatchingServiceLabel(service) ?? service;
  const isSubmitting = isSaving || submittingMethod !== undefined;
  const isPaymentActionDisabled = !canValidate || isSubmitting || isDeleting;

  useEffect(() => {
    if (!isSaving && isSubmittingRef.current) {
      isSubmittingRef.current = false;
      const timeoutId = window.setTimeout(() => {
        setSubmittingMethod(undefined);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [isSaving]);

  function selectService(serviceLabel: string) {
    setService(serviceLabel);
    setAmount(getDefaultAmountFromService(serviceLabel));
  }

  function submitPayment(paymentMethod = method) {
    if (!canValidate || isSaving || isDeleting || isSubmittingRef.current) {
      return;
    }

    isSubmittingRef.current = true;
    setSubmittingMethod(paymentMethod);
    const normalizedClientName = normalizeClientName(clientName);
    const { clientFirstName, clientLastName } =
      splitClientName(normalizedClientName);

    onValidate({
      amount: parsedAmount,
      clientFirstName,
      clientLastName,
      clientName: normalizedClientName || null,
      method: paymentMethod,
      service,
    });
  }

  return (
    <div
      aria-modal="true"
      aria-labelledby="payment-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-2 backdrop-blur-sm sm:p-6"
      role="dialog"
    >
      <div className="flex max-h-[calc(100vh-16px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100vh-48px)]">
        <div className="border-b border-amber-100 bg-amber-50/70 px-4 py-3 sm:px-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2
                className="text-lg font-semibold text-zinc-950"
                id="payment-modal-title"
              >
                {isEditing
                  ? "Modifier le paiement"
                  : "Renseigner un paiement"}
              </h2>
            </div>
            <button
              aria-label="Fermer"
              className="rounded-lg px-3 py-2 text-xl leading-none text-zinc-500 hover:bg-white hover:text-zinc-900"
              disabled={isSubmitting || isDeleting}
              onClick={onClose}
              type="button"
            >
              ×
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-4 py-3 sm:px-5">
          <dl className="grid gap-2 rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-sm sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="font-medium text-zinc-500">Contact</dt>
              <dd className="break-words font-medium text-zinc-800">
                {contactDisplay}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500">Date</dt>
              <dd className="font-medium text-zinc-800">
                {formatDate(event.startAt)} • {formatTime(event.startAt)} -{" "}
                {formatTime(event.endAt)}
              </dd>
            </div>
          </dl>

          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem]">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Nom du client
              <input
                className="h-10 rounded-xl border border-zinc-300 bg-white px-3 text-base outline-none transition focus:border-amber-600 focus:ring-2 focus:ring-amber-600/15"
                onChange={(event) => setClientName(event.target.value)}
                placeholder="Nom du client"
                type="text"
                value={clientName}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Montant
              <div className="flex h-10 items-center rounded-xl border border-zinc-300 bg-white focus-within:border-amber-600 focus-within:ring-2 focus-within:ring-amber-600/15">
                <input
                  className="h-full min-w-0 flex-1 rounded-lg px-3 text-base outline-none"
                  inputMode="decimal"
                  min="0"
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0"
                  step="1"
                  type="number"
                  value={amount}
                />
                <span className="border-l border-zinc-200 px-3 text-zinc-500">
                  €
                </span>
              </div>
            </label>
          </div>

          <div className="mt-3">
            <fieldset>
              <legend className="text-sm font-medium">Prestation</legend>
              <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                {services.map((serviceOption) => {
                  const isSelected = selectedServiceLabel === serviceOption.label;

                  return (
                    <button
                      aria-pressed={isSelected}
                      className={`flex h-10 items-center justify-center rounded-xl border px-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-amber-600/20 ${
                        isSelected
                          ? "border-amber-600 bg-amber-600 text-white"
                          : "border-zinc-200 bg-white text-zinc-800 hover:border-amber-300 hover:bg-amber-50"
                      }`}
                      key={serviceOption.label}
                      onClick={() => selectService(serviceOption.label)}
                      type="button"
                    >
                      {getServiceButtonLabel(serviceOption.label)}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>

          <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/50 p-3">
            <fieldset>
              <legend className="text-sm font-semibold text-amber-950">
                Encaisser avec :
              </legend>
              <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
                {paymentMethods.map((paymentMethod) => {
                  const isSelected = method === paymentMethod;
                  const isSubmittingMethod = submittingMethod === paymentMethod;

                  return (
                    <button
                      aria-pressed={isSelected}
                      className={`flex h-10 items-center justify-center rounded-xl border px-3 text-sm font-semibold capitalize transition focus:outline-none focus:ring-2 focus:ring-amber-600/20 disabled:cursor-not-allowed ${
                        isSelected
                          ? "border-amber-600 bg-amber-600 text-white"
                          : "border-zinc-200 bg-white text-zinc-800 hover:border-amber-300 hover:bg-amber-50"
                      } disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400`}
                      disabled={isPaymentActionDisabled}
                      key={paymentMethod}
                      onClick={() => {
                        setMethod(paymentMethod);
                        submitPayment(paymentMethod);
                      }}
                      type="button"
                    >
                      {isSubmittingMethod ? "Enregistrement..." : paymentMethod}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>

          {errorMessage ? (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            {isEditing ? (
              <button
                className="h-10 rounded-xl border border-red-200 bg-white px-4 font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-300"
                disabled={isSubmitting || isDeleting}
                onClick={onDelete}
                type="button"
              >
                {isDeleting ? "Suppression..." : "Supprimer le paiement"}
              </button>
            ) : null}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              className="h-10 rounded-xl border border-zinc-300 bg-white px-4 font-medium text-zinc-700 hover:bg-zinc-50"
              disabled={isSubmitting || isDeleting}
              onClick={onClose}
              type="button"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
