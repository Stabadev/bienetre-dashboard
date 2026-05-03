export const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "full",
  timeZone: "Europe/Paris",
});

export const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

export const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  currency: "EUR",
  style: "currency",
});

export function formatDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

export function formatTime(value: string): string {
  return timeFormatter.format(new Date(value));
}

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}
