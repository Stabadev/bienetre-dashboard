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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildBookingConfirmationText({
  clientName,
  confirmationUrl,
  durationMinutes,
  endAt,
  service,
  startAt,
}: {
  clientName: string;
  confirmationUrl: string;
  durationMinutes: number;
  endAt: Date;
  service: string;
  startAt: Date;
}) {
  return [
    `Bonjour ${clientName},`,
    "",
    "Votre demande de rendez-vous a bien été préparée.",
    "",
    `Prestation : ${service}`,
    `Date : ${formatDate(startAt.toISOString())}`,
    `Horaire : ${formatTime(startAt.toISOString())} - ${formatTime(
      endAt.toISOString(),
    )}`,
    `Durée : ${durationMinutes} minutes`,
    "",
    "Pour confirmer votre demande, ouvrez ce lien :",
    confirmationUrl,
    "",
    "Ce lien est valable 24 heures.",
    "Pensez à vérifier vos spams si vous ne trouvez pas nos emails.",
    "",
    "Bien-être des Sagesses",
  ].join("\n");
}

function buildBookingConfirmationHtml({
  clientName,
  confirmationUrl,
  durationMinutes,
  endAt,
  service,
  startAt,
}: {
  clientName: string;
  confirmationUrl: string;
  durationMinutes: number;
  endAt: Date;
  service: string;
  startAt: Date;
}) {
  const escapedClientName = escapeHtml(clientName);
  const escapedConfirmationUrl = escapeHtml(confirmationUrl);
  const escapedDate = escapeHtml(formatDate(startAt.toISOString()));
  const escapedEndTime = escapeHtml(formatTime(endAt.toISOString()));
  const escapedService = escapeHtml(service);
  const escapedStartTime = escapeHtml(formatTime(startAt.toISOString()));

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Confirmez votre rendez-vous</title>
  </head>
  <body style="margin:0; padding:0; background:#f8fafc; color:#18181b; font-family:Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc; width:100%;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px; background:#ffffff; border:1px solid #e4e4e7; border-radius:14px; overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 18px;">
                <p style="margin:0 0 8px; color:#b45309; font-size:13px; font-weight:700; letter-spacing:.04em; text-transform:uppercase;">Bien-être des Sagesses</p>
                <h1 style="margin:0; color:#18181b; font-size:26px; line-height:1.25;">Confirmez votre rendez-vous</h1>
                <p style="margin:16px 0 0; color:#3f3f46; font-size:16px; line-height:1.6;">Bonjour ${escapedClientName}, votre demande de rendez-vous a bien été préparée.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fffbeb; border:1px solid #fde68a; border-radius:12px;">
                  <tr>
                    <td style="padding:18px;">
                      <p style="margin:0 0 10px; color:#78350f; font-size:14px; font-weight:700;">Récapitulatif</p>
                      <p style="margin:0 0 6px; color:#18181b; font-size:15px; line-height:1.5;"><strong>Type de séance :</strong> ${escapedService}</p>
                      <p style="margin:0 0 6px; color:#18181b; font-size:15px; line-height:1.5;"><strong>Date :</strong> ${escapedDate}</p>
                      <p style="margin:0 0 6px; color:#18181b; font-size:15px; line-height:1.5;"><strong>Heure :</strong> ${escapedStartTime} - ${escapedEndTime}</p>
                      <p style="margin:0; color:#18181b; font-size:15px; line-height:1.5;"><strong>Durée :</strong> ${durationMinutes} minutes</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 28px 26px;">
                <a href="${escapedConfirmationUrl}" style="display:inline-block; background:#059669; color:#ffffff; font-size:16px; font-weight:700; text-decoration:none; padding:14px 22px; border-radius:10px;">Confirmer mon rendez-vous</a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 28px;">
                <p style="margin:0 0 10px; color:#52525b; font-size:14px; line-height:1.6;">Si le bouton ne fonctionne pas, copiez-collez ce lien :</p>
                <p style="margin:0; word-break:break-all; color:#0f766e; font-size:14px; line-height:1.6;">${escapedConfirmationUrl}</p>
                <p style="margin:18px 0 0; color:#71717a; font-size:14px; line-height:1.6;">Ce lien est valable 24 heures. Pensez à vérifier vos spams si vous ne trouvez pas nos emails.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
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
  const durationMinutes = Math.round(
    (endAt.getTime() - startAt.getTime()) / 60_000,
  );

  await sendSmtpEmail({
    html: buildBookingConfirmationHtml({
      clientName,
      confirmationUrl,
      durationMinutes,
      endAt,
      service,
      startAt,
    }),
    to: clientEmail,
    subject: "Confirmez votre demande de rendez-vous",
    text: buildBookingConfirmationText({
      clientName,
      confirmationUrl,
      durationMinutes,
      endAt,
      service,
      startAt,
    }),
  });
}
