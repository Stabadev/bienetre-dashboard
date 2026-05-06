import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { formatCurrency } from "@/components/dashboard/formatters";
import { isAuthenticated } from "@/lib/auth";
import { buildPaymentExportRows } from "@/lib/csv";
import type { PaymentExportRow } from "@/lib/csv";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DashboardExportPage() {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  const payments = await db.payment.findMany({
    orderBy: {
      startAt: "asc",
    },
  });
  const rows = buildPaymentExportRows(payments);
  const totals = getExportTotals(rows);

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#fff7ed_0%,#f8fafc_42%,#ecfdf5_100%)] px-4 py-6 text-zinc-950 sm:px-6 sm:py-10">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
              Export
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Tableau des paiements
            </h1>
            <p className="mt-2 text-zinc-600">
              Aperçu des paiements enregistrés avant export CSV.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white/90 px-4 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-amber-300 hover:bg-white"
              href="/dashboard"
            >
              Retour dashboard
            </Link>
            <a
              className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
              download="paiements-bienetre-dashboard.csv"
              href="/api/export"
            >
              Exporter CSV
            </a>
            <LogoutButton />
          </div>
        </header>

        <ExportTotals totals={totals} />

        <section className="overflow-hidden rounded-3xl border border-white/70 bg-white/80 shadow-sm backdrop-blur">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-zinc-950 text-white">
                <tr>
                  {[
                    "Date",
                    "Client",
                    "Espèces",
                    "Chèque",
                    "Virement",
                    "Prestation",
                  ].map((header) => (
                    <th className="px-4 py-3 font-semibold" key={header}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {rows.length > 0 ? (
                  rows.map((row, index) => (
                    <tr className="bg-white/70" key={`${row.date}-${index}`}>
                      <td className="whitespace-nowrap px-4 py-3 font-medium">
                        {row.date}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {row.client}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {formatAmountCell(row.cashAmount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {formatAmountCell(row.checkAmount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {formatAmountCell(row.transferAmount)}
                      </td>
                      <td className="min-w-56 px-4 py-3">{row.service}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      className="px-4 py-8 text-center text-sm text-zinc-500"
                      colSpan={6}
                    >
                      Aucun paiement enregistré pour le moment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}

function formatAmountCell(value: number | ""): string {
  return value === "" ? "" : formatCurrency(value);
}

function getExportTotals(rows: PaymentExportRow[]) {
  return rows.reduce(
    (totals, row) => {
      const cashAmount = row.cashAmount === "" ? 0 : row.cashAmount;
      const checkAmount = row.checkAmount === "" ? 0 : row.checkAmount;
      const transferAmount = row.transferAmount === "" ? 0 : row.transferAmount;

      return {
        cash: totals.cash + cashAmount,
        check: totals.check + checkAmount,
        transfer: totals.transfer + transferAmount,
        total: totals.total + cashAmount + checkAmount + transferAmount,
      };
    },
    { cash: 0, check: 0, transfer: 0, total: 0 },
  );
}

function ExportTotals({
  totals,
}: {
  totals: {
    cash: number;
    check: number;
    transfer: number;
    total: number;
  };
}) {
  const cards = [
    { label: "Total espèces", value: totals.cash },
    { label: "Total chèque", value: totals.check },
    { label: "Total virement", value: totals.transfer },
    { label: "Total général", value: totals.total },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <article
          className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-sm"
          key={card.label}
        >
          <p className="text-sm font-medium text-zinc-500">{card.label}</p>
          <p className="mt-3 text-2xl font-semibold text-zinc-950">
            {formatCurrency(card.value)}
          </p>
        </article>
      ))}
    </section>
  );
}
