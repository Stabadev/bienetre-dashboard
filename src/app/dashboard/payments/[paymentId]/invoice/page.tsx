"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type InvoiceForm = {
  number: string;
  issueDate: string;
  clientFirstName: string;
  clientLastName: string;
  clientName: string;
  service: string;
  serviceDate: string;
  amount: string;
  method: string;
  notes: string;
};

type InvoiceResponse = {
  id?: string;
  number: string | null;
  issueDate: string;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  service: string | null;
  serviceDate: string;
  amount: number;
  method: string;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

const emptyForm: InvoiceForm = {
  number: "",
  issueDate: "",
  clientFirstName: "",
  clientLastName: "",
  clientName: "",
  service: "",
  serviceDate: "",
  amount: "",
  method: "",
  notes: "",
};

function toDateInputValue(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function formatDisplayDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function buildClientName(firstName: string, lastName: string, fallback: string) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || fallback;
}

function buildInvoiceForm(invoice: InvoiceResponse, number: string): InvoiceForm {
  return {
    number,
    issueDate: toDateInputValue(invoice.issueDate),
    clientFirstName: invoice.clientFirstName ?? "",
    clientLastName: invoice.clientLastName ?? "",
    clientName: invoice.clientName ?? "",
    service: invoice.service ?? "",
    serviceDate: toDateInputValue(invoice.serviceDate),
    amount: invoice.amount.toString(),
    method: invoice.method,
    notes: invoice.notes ?? "",
  };
}

async function readErrorMessage(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  return payload?.error ?? "La requête a échoué.";
}

export default function InvoicePage() {
  const params = useParams<{ paymentId: string }>();
  const paymentId = params.paymentId;
  const [form, setForm] = useState<InvoiceForm>(emptyForm);
  const [savedForm, setSavedForm] = useState<InvoiceForm>(emptyForm);
  const [invoiceCreatedAt, setInvoiceCreatedAt] = useState<string | null>(null);
  const [hasExistingInvoice, setHasExistingInvoice] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>();
  const hasUnsavedChanges =
    JSON.stringify(form) !== JSON.stringify(savedForm);

  useEffect(() => {
    let isMounted = true;

    async function loadInvoice() {
      setIsLoading(true);
      setErrorMessage(undefined);

      try {
        const invoiceResponse = await fetch(
          `/api/payments/${encodeURIComponent(paymentId)}/invoice`,
        );

        if (!invoiceResponse.ok) {
          throw new Error(await readErrorMessage(invoiceResponse));
        }

        const invoice = (await invoiceResponse.json()) as InvoiceResponse;
        let number = invoice.number ?? "";

        if (!number) {
          const numberResponse = await fetch("/api/invoices/next-number");

          if (!numberResponse.ok) {
            throw new Error(await readErrorMessage(numberResponse));
          }

          const nextNumber = (await numberResponse.json()) as {
            nextNumber: string;
          };

          number = nextNumber.nextNumber;
        }

        if (!isMounted) {
          return;
        }

        const loadedForm = buildInvoiceForm(invoice, number);

        setForm(loadedForm);
        setSavedForm(loadedForm);
        setHasExistingInvoice(Boolean(invoice.id));
        setInvoiceCreatedAt(invoice.createdAt ?? null);
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Impossible de charger la facture.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadInvoice();

    return () => {
      isMounted = false;
    };
  }, [paymentId]);

  function updateField(field: keyof InvoiceForm, value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
    setSuccessMessage(undefined);
  }

  async function saveInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage(undefined);
    setSuccessMessage(undefined);

    try {
      const clientName = buildClientName(
        form.clientFirstName,
        form.clientLastName,
        form.clientName,
      );
      const response = await fetch(
        `/api/payments/${encodeURIComponent(paymentId)}/invoice`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            number: form.number,
            issueDate: form.issueDate,
            sellerName: "Julie Surrel",
            sellerAddress: "253 rue Emmanuel Mauras, 43260 St Julien Chapteuil",
            sellerSiret: "495 046 021 000 46",
            sellerPhone: "06 60 05 36 70",
            sellerEmail: "bienetre.des.sagesses@gmail.com",
            clientFirstName: form.clientFirstName,
            clientLastName: form.clientLastName,
            clientName,
            clientEmail: null,
            clientPhone: null,
            service: form.service,
            serviceDate: form.serviceDate,
            amount: Number(form.amount),
            method: form.method,
            notes: form.notes || null,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const savedInvoice = (await response.json()) as InvoiceResponse;
      const savedFormFromResponse = {
        ...form,
        number: savedInvoice.number ?? form.number,
        issueDate: toDateInputValue(savedInvoice.issueDate),
        serviceDate: toDateInputValue(savedInvoice.serviceDate),
        clientName: savedInvoice.clientName ?? clientName,
        amount: savedInvoice.amount.toString(),
      };

      setForm(savedFormFromResponse);
      setSavedForm(savedFormFromResponse);
      setHasExistingInvoice(Boolean(savedInvoice.id));
      setInvoiceCreatedAt(savedInvoice.createdAt ?? null);
      setSuccessMessage("Facture enregistrée");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible d'enregistrer la facture.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#fff7ed_0%,#f8fafc_48%,#ecfdf5_100%)] px-4 py-6 text-zinc-950 sm:px-6 sm:py-10">
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
              Facturation
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Facture du paiement
            </h1>
          </div>
          <Link
            className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white/90 px-4 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-amber-300 hover:bg-white"
            href="/dashboard"
          >
            Retour dashboard
          </Link>
        </header>

        <form
          className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
          onSubmit={saveInvoice}
        >
          {isLoading ? (
            <p className="text-sm font-medium text-zinc-600">
              Chargement de la facture...
            </p>
          ) : (
            <div className="flex flex-col gap-5">
              {hasExistingInvoice ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                  {invoiceCreatedAt
                    ? `Facture enregistrée le ${formatDisplayDate(
                        invoiceCreatedAt,
                      )}`
                    : "Facture enregistrée"}
                </p>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Numéro facture"
                  onChange={(value) => updateField("number", value)}
                  value={form.number}
                />
                <TextField
                  label="Date facture"
                  onChange={(value) => updateField("issueDate", value)}
                  type="date"
                  value={form.issueDate}
                />
                <TextField
                  label="Prénom client"
                  onChange={(value) => updateField("clientFirstName", value)}
                  value={form.clientFirstName}
                />
                <TextField
                  label="Nom client"
                  onChange={(value) => updateField("clientLastName", value)}
                  value={form.clientLastName}
                />
                <TextField
                  label="Prestation"
                  onChange={(value) => updateField("service", value)}
                  value={form.service}
                />
                <TextField
                  label="Date du soin"
                  onChange={(value) => updateField("serviceDate", value)}
                  type="date"
                  value={form.serviceDate}
                />
                <TextField
                  label="Montant"
                  onChange={(value) => updateField("amount", value)}
                  type="number"
                  value={form.amount}
                />
                <TextField
                  label="Mode de paiement"
                  onChange={(value) => updateField("method", value)}
                  value={form.method}
                />
              </div>

              <label className="flex flex-col gap-2 text-sm font-medium">
                Note personnelle
                <textarea
                  className="min-h-28 rounded-xl border border-zinc-300 bg-white px-3 py-3 text-base outline-none transition focus:border-amber-600 focus:ring-2 focus:ring-amber-600/15"
                  onChange={(event) => updateField("notes", event.target.value)}
                  value={form.notes}
                />
                <span className="text-sm font-normal text-zinc-600">
                  Cette note n’apparaît pas sur la facture.
                </span>
              </label>

              {errorMessage ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {errorMessage}
                </p>
              ) : null}

              {successMessage ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                  {successMessage}
                </p>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                {hasUnsavedChanges ? (
                  <button
                    className="h-12 rounded-xl border border-zinc-300 bg-white px-5 font-semibold text-zinc-800 shadow-sm transition hover:border-amber-300 hover:bg-zinc-50"
                    onClick={() => {
                      setForm(savedForm);
                      setErrorMessage(undefined);
                      setSuccessMessage(undefined);
                    }}
                    type="button"
                  >
                    Annuler les modifications
                  </button>
                ) : null}
                <a
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 font-semibold text-zinc-800 shadow-sm transition hover:border-amber-300 hover:bg-zinc-50"
                  href={`/api/payments/${encodeURIComponent(paymentId)}/invoice/pdf`}
                  rel="noreferrer"
                  target="_blank"
                >
                  Ouvrir le PDF
                </a>
                <button
                  className="h-12 rounded-xl bg-amber-600 px-5 font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
                  disabled={isSaving}
                  type="submit"
                >
                  {isSaving ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </div>
          )}
        </form>
      </section>
    </main>
  );
}

function TextField({
  label,
  onChange,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium">
      {label}
      <input
        className="h-12 rounded-xl border border-zinc-300 bg-white px-3 text-base outline-none transition focus:border-amber-600 focus:ring-2 focus:ring-amber-600/15"
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </label>
  );
}
