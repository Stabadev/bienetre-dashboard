type CsvPayment = {
  title: string;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientName: string | null;
  service: string | null;
  startAt: Date;
  amount: number;
  method: string;
};

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
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

function formatUppercase(value: string | null): string {
  return value?.toLocaleUpperCase("fr-FR") ?? "";
}

function normalizePaymentMethod(method: string): string {
  return method
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr-FR")
    .trim();
}

function getAmountColumns(payment: CsvPayment): [number | "", number | "", number | ""] {
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

export function buildPaymentsCsv(payments: CsvPayment[]): string {
  const headers = [
    "Date",
    "Nom",
    "Prénom",
    "Espèces",
    "Chèque",
    "Virement",
    "Prestation",
  ];

  const rows = payments.map((payment) => {
    const [cashAmount, checkAmount, transferAmount] = getAmountColumns(payment);

    return [
      dateFormatter.format(payment.startAt),
      formatUppercase(payment.clientLastName ?? payment.clientName),
      formatUppercase(payment.clientFirstName),
      cashAmount,
      checkAmount,
      transferAmount,
      payment.service ?? payment.title,
    ];
  });

  const csvContent = [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(";"))
    .join("\n");

  return `\uFEFF${csvContent}`;
}
