import crypto from "node:crypto";
import { formatDate, formatTime } from "@/components/dashboard/formatters";
import { sendSmtpEmail } from "@/lib/smtp";

const confirmationTokenDurationMs = 24 * 60 * 60 * 1000;

export function createBookingConfirmationToken() {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashBookingConfirmationToken(token);
  const expiresAt = new Date(Date.now() + confirmationTokenDurationMs);

  return {
    expiresAt,
    token,
    tokenHash,
  };
}

export function hashBookingConfirmationToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getAppBaseUrl(): string {
  const appBaseUrl = process.env.APP_BASE_URL;

  if (!appBaseUrl) {
    throw new Error("APP_BASE_URL est manquante.");
  }

  return appBaseUrl.replace(/\/+$/, "");
}

export function getBookingConfirmationUrl(token: string): string {
  const url = new URL("/reservation/confirmer", getAppBaseUrl());

  url.searchParams.set("token", token);

  return url.toString();
}

export async function sendBookingConfirmationEmail({
  clientEmail,
  clientName,
  confirmationUrl,
  endAt,
  service,
  startAt,
}: {
  clientEmail: string;
  clientName: string;
  confirmationUrl: string;
  endAt: Date;
  service: string;
  startAt: Date;
}) {
  await sendSmtpEmail({
    to: clientEmail,
    subject: "Confirmez votre demande de rendez-vous",
    text: [
      `Bonjour ${clientName},`,
      "",
      "Votre demande de rendez-vous a bien été préparée.",
      "",
      `Prestation : ${service}`,
      `Date : ${formatDate(startAt.toISOString())}`,
      `Horaire : ${formatTime(startAt.toISOString())} - ${formatTime(
        endAt.toISOString(),
      )}`,
      "",
      "Pour confirmer votre demande, ouvrez ce lien :",
      confirmationUrl,
      "",
      "Ce lien est valable 24 heures.",
      "",
      "Bien-être des Sagesses",
    ].join("\n"),
  });
}
