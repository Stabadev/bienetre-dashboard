export type PaymentMethod = "espèces" | "chèque" | "virement";

export type Service = "Première séance" | "Séance d’entretien";

export type SavedPayment = {
  id: string;
  appointmentUid: string;
  title: string;
  clientName: string | null;
  service: string | null;
  startAt: string;
  endAt: string;
  amount: number;
  method: string;
  paidAt: string;
  createdAt: string;
  updatedAt: string;
};

export type PaymentDraft = {
  amount: number;
  method: PaymentMethod;
  service: Service;
};
