export type ReservationServiceType = "premier-rdv" | "suivi";

export type ReservationServiceConfig = {
  description: string;
  durationMinutes: 60 | 90;
  label: string;
  path: string;
  shortLabel: string;
  title: string;
};

export const reservationServices = {
  "premier-rdv": {
    description:
      "Une séance d'1h30 pour prendre le temps d'échanger, faire le point et poser les bases du suivi.",
    durationMinutes: 90,
    label: "Premier rendez-vous",
    path: "/reservation/premier-rdv",
    shortLabel: "1h30",
    title: "Réserver un premier rendez-vous",
  },
  suivi: {
    description:
      "Une séance d'1h pour poursuivre le travail engagé lors d'un précédent rendez-vous.",
    durationMinutes: 60,
    label: "Séance de suivi",
    path: "/reservation/suivi",
    shortLabel: "1h",
    title: "Réserver une séance de suivi",
  },
} satisfies Record<ReservationServiceType, ReservationServiceConfig>;

export function getReservationService(
  serviceType: string,
): ReservationServiceConfig | null {
  if (serviceType === "premier-rdv" || serviceType === "suivi") {
    return reservationServices[serviceType];
  }

  return null;
}
