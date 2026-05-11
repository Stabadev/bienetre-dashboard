import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { CalendarError, getCalendarEvents } from "@/lib/calendar";
import type { CalendarEvent } from "@/lib/calendar";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

type DashboardPageProps = {
  searchParams: Promise<{
    refresh?: string;
  }>;
};

type DashboardCalendarState = {
  events: CalendarEvent[];
  lastFetchedAt: string;
  isStale: boolean;
  refreshError: string | null;
};

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  const { refresh } = await searchParams;
  const result = await loadEvents(Boolean(refresh));

  if (!result.ok) {
    return <DashboardError message={result.message} />;
  }

  return <Dashboard calendar={result.calendar} />;
}

async function loadEvents(forceRefresh: boolean): Promise<
  | { ok: true; calendar: DashboardCalendarState }
  | { ok: false; message: string }
> {
  try {
    const result = await getCalendarEvents({ forceRefresh });

    return {
      ok: true,
      calendar: {
        events: result.events,
        lastFetchedAt: result.lastFetchedAt,
        isStale: result.isStale,
        refreshError: result.refreshError,
      },
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof CalendarError
          ? error.message
          : "Impossible d'afficher les rendez-vous.",
    };
  }
}

function Dashboard({ calendar }: { calendar: DashboardCalendarState }) {
  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#fff7ed_0%,#f8fafc_42%,#ecfdf5_100%)] px-4 py-6 text-zinc-950 sm:px-6 sm:py-10">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
                Administration
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Tableau de bord
              </h1>
              <p className="mt-2 text-zinc-600">
                Rendez-vous importés depuis Calendly
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                href="/dashboard/export"
              >
                Voir le tableau / Export
              </Link>
              <Link
                className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white/90 px-4 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-amber-300 hover:bg-white"
                href="/dashboard/disponibilites"
              >
                Disponibilités
              </Link>
              <Link
                className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white/90 px-4 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-amber-300 hover:bg-white"
                href="/help"
              >
                Aide
              </Link>
              <Link
                className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white/90 px-4 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-amber-300 hover:bg-white"
                href="/"
              >
                Retour accueil
              </Link>
              <LogoutButton />
            </div>
          </div>
        </header>

        <DashboardClient
          events={calendar.events}
          isCalendarStale={calendar.isStale}
          lastFetchedAt={calendar.lastFetchedAt}
          refreshError={calendar.refreshError}
        />
      </section>
    </main>
  );
}

function DashboardError({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 text-zinc-950">
      <section className="w-full max-w-xl rounded-lg border border-red-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Calendrier indisponible</h1>
        <p className="mt-3 text-zinc-700">{message}</p>
      </section>
    </main>
  );
}
