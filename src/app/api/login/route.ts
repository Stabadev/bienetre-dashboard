import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { createSessionToken, setSessionCookie } from "@/lib/auth";

type LoginPayload = {
  username?: unknown;
  password?: unknown;
};

export async function POST(request: Request) {
  let body: LoginPayload;

  try {
    body = (await request.json()) as LoginPayload;
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!adminUsername || !adminPasswordHash || !sessionSecret) {
    return NextResponse.json(
      { error: "Authentification non configurée." },
      { status: 500 },
    );
  }

  if (typeof body.username !== "string" || typeof body.password !== "string") {
    return NextResponse.json(
      { error: "Identifiants invalides." },
      { status: 401 },
    );
  }

  const submittedUsername = body.username.trim();
  const configuredUsername = adminUsername.trim();
  const isValidPassword = await compare(body.password, adminPasswordHash);

  if (submittedUsername !== configuredUsername || !isValidPassword) {
    return NextResponse.json(
      { error: "Identifiants invalides." },
      { status: 401 },
    );
  }

  const token = await createSessionToken(configuredUsername);
  await setSessionCookie(token);

  return NextResponse.json({ ok: true });
}
