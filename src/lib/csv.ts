type CsvPayment = {
  title: string;
  clientName: string | null;
  service: string | null;
  startAt: Date;
  endAt: Date;
  amount: number;
  method: string;
};

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Paris",
});

const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

function escapeCsvValue(value: string | number): string {
  const stringValue = String(value);

  if (
    stringValue.includes(";") ||
    stringValue.includes("\"") ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replaceAll("\"", "\"\"")}"`;
  }

  return stringValue;
}

export function buildPaymentsCsv(payments: CsvPayment[]): string {
  const headers = [
    "date",
    "heure_debut",
    "heure_fin",
    "client",
    "prestation",
    "montant",
    "mode_paiement",
  ];

  const rows = payments.map((payment) => [
    dateFormatter.format(payment.startAt),
    timeFormatter.format(payment.startAt),
    timeFormatter.format(payment.endAt),
    payment.clientName ?? payment.title,
    payment.service ?? "",
    payment.amount,
    payment.method,
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(";"))
    .join("\n");

  return `\uFEFF${csvContent}`;
}
