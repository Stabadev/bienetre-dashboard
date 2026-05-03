import type { CalendarEvent } from "@/lib/calendar";

export type PaymentMethod = "espèces" | "chèque" | "virement" | "carte";

export type SavedPayment = {
  id: string;
  appointmentUid: string;
  title: string;
  clientName: string | null;
  service: string | null;
  startAt: string;
  endAt: string;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
  createdAt: string;
  updatedAt: string;
};

export type PaymentDraft = {
  amount: number;
  method: PaymentMethod;
};

export type AppointmentPayment = SavedPayment | (PaymentDraft & { event: CalendarEvent });
