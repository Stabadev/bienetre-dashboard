import { CalendarError, getCalendarEvents } from "@/lib/calendar";
import type { CalendarEvent } from "@/lib/calendar";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const result = await loadEvents();

  if (!result.ok) {
    return <DashboardError message={result.message} />;
  }

  return <Dashboard events={result.events} />;
}

async function loadEvents(): Promise<
  | { ok: true; events: CalendarEvent[] }
  | { ok: false; message: string }
> {
  try {
    const events = await getCalendarEvents();

    return { ok: true, events };
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

function Dashboard({ events }: { events: CalendarEvent[] }) {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header>
          <h1 className="text-3xl font-semibold">Tableau de bord</h1>
          <p className="mt-2 text-zinc-600">Rendez-vous Google Calendar</p>
        </header>

        <DashboardClient events={events} />
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
