"use client";

import { formatCurrency, formatDate, formatTime } from "./formatters";
import type { SavedPayment } from "./types";

type PaymentsSidebarProps = {
  payments: SavedPayment[];
};

export function PaymentsSidebar({ payments }: PaymentsSidebarProps) {
  function downloadCsv() {
    const link = document.createElement("a");

    link.href = "/api/export";
    link.download = "paiements-bienetre-dashboard.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <aside className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm md:sticky md:top-6 md:self-start">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between md:flex-col md:items-stretch">
        <h2 className="text-lg font-semibold">Paiements renseignés</h2>
        <button
          className="h-10 rounded-lg border border-zinc-300 px-3 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
          onClick={downloadCsv}
          type="button"
        >
          Exporter CSV
        </button>
      </div>

      {payments.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600">
          Aucun paiement renseigné pour le moment.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {payments.map((payment) => (
            <li
              className="rounded-lg border border-zinc-100 bg-zinc-50 p-3"
              key={payment.appointmentUid}
            >
              <p className="font-medium">{payment.title}</p>
              <p className="mt-1 text-sm text-zinc-600">
                {formatDate(payment.startAt)} à {formatTime(payment.startAt)}
              </p>
              <p className="mt-2 text-sm">
                <span className="font-semibold">
                  {formatCurrency(payment.amount)}
                </span>{" "}
                par {payment.method}
              </p>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
