import { buildClientName } from "@/lib/client-name";

export type ExportPayment = {
  title: string;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientName: string | null;
  service: string | null;
  startAt: Date;
  amount: number;
  method: string;
};

export type PaymentExportRow = {
  date: string;
  client: string;
  cashAmount: number | "";
  checkAmount: number | "";
  transferAmount: number | "";
  service: string;
};

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Paris",
});

function escapeCsvValue(value: string | number): string {
  const rawStringValue = String(value);
  const stringValue = /^[=+\-@\t]/.test(rawStringValue)
    ? `'${rawStringValue}`
    : rawStringValue;

  if (
    stringValue.includes(";") ||
    stringValue.includes("\"") ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replaceAll("\"", "\"\"")}"`;
  }

  return stringValue;
}

function normalizePaymentMethod(method: string): string {
  return method
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr-FR")
    .trim();
}

function getAmountColumns(
  payment: ExportPayment,
): [number | "", number | "", number | ""] {
  const method = normalizePaymentMethod(payment.method);

  if (method === "especes" || method === "espece" || method === "cash") {
    return [payment.amount, "", ""];
  }

  if (method === "cheque") {
    return ["", payment.amount, ""];
  }

  if (method === "virement") {
    return ["", "", payment.amount];
  }

  return ["", "", ""];
}

export function buildPaymentExportRows(
  payments: ExportPayment[],
): PaymentExportRow[] {
  return payments.map((payment) => {
    const [cashAmount, checkAmount, transferAmount] = getAmountColumns(payment);

    return {
      date: dateFormatter.format(payment.startAt),
      client: buildClientName({
        clientFirstName: payment.clientFirstName,
        clientLastName: payment.clientLastName,
        clientName: payment.clientName,
      }),
      cashAmount,
      checkAmount,
      transferAmount,
      service: payment.service ?? payment.title,
    };
  });
}

export function buildPaymentsCsv(payments: ExportPayment[]): string {
  const headers = [
    "Date",
    "Client",
    "Espèces",
    "Chèque",
    "Virement",
    "Prestation",
  ];

  const rows = buildPaymentExportRows(payments).map((row) => [
    row.date,
    row.client,
    row.cashAmount,
    row.checkAmount,
    row.transferAmount,
    row.service,
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(";"))
    .join("\n");

  return `\uFEFF${csvContent}`;
}
