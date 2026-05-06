export function normalizeClientName(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLocaleUpperCase("fr-FR");
}

export function buildClientName({
  clientFirstName,
  clientLastName,
  clientName,
  fallback,
}: {
  clientFirstName?: string | null;
  clientLastName?: string | null;
  clientName?: string | null;
  fallback?: string | null;
}): string {
  const normalizedClientName = normalizeClientName(clientName);

  if (normalizedClientName) {
    return normalizedClientName;
  }

  const normalizedLegacyName = normalizeClientName(
    [clientFirstName, clientLastName].filter(Boolean).join(" "),
  );

  if (normalizedLegacyName) {
    return normalizedLegacyName;
  }

  return normalizeClientName(fallback);
}

export function splitClientName(value: string): {
  clientFirstName: string | null;
  clientLastName: string | null;
} {
  const parts = normalizeClientName(value).split(/\s+/).filter(Boolean);

  return {
    clientFirstName: parts.length > 1 ? parts.slice(0, -1).join(" ") : null,
    clientLastName: parts.at(-1) ?? null,
  };
}
