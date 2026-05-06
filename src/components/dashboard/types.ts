export type PaymentMethod = "espèces" | "chèque" | "virement";

export type Service = "Première séance" | "Séance d’entretien";

export type SavedPayment = {
  id: string;
  appointmentUid: string;
  calendlyEventUri: string | null;
  calendlyInviteeUri: string | null;
  title: string;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  service: string | null;
  startAt: string;
  endAt: string;
  amount: number;
  method: string;
  paidAt: string;
  hasInvoice: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PaymentDraft = {
  amount: number;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientName: string | null;
  method: PaymentMethod;
  service: string;
};
