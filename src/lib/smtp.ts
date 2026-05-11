import crypto from "node:crypto";
import net from "node:net";
import tls from "node:tls";

type SmtpConfig = {
  envelopeFrom: string;
  fromHeader: string;
  host: string;
  port: number;
  user: string;
  password: string;
};

export type SmtpEmail = {
  html?: string;
  to: string;
  subject: string;
  text: string;
};

function readSmtpConfig(): SmtpConfig {
  const host = readOptionalEnv("SMTP_HOST");
  const port = Number(process.env.SMTP_PORT);
  const user = readOptionalEnv("SMTP_USER");
  const password = readOptionalEnv("SMTP_PASSWORD");
  const legacyFrom = readOptionalEnv("SMTP_FROM");
  const fromAddress = readOptionalEnv("SMTP_FROM_ADDRESS") ?? legacyFrom;
  const fromName = readOptionalEnv("SMTP_FROM_NAME");

  if (!host || !Number.isInteger(port) || !user || !password || !fromAddress) {
    throw new Error("Configuration SMTP incomplète.");
  }

  const envelopeFrom = extractEmailAddress(fromAddress);

  return {
    envelopeFrom,
    fromHeader: buildFromHeader({
      address: envelopeFrom,
      legacyFrom,
      name: fromName,
    }),
    host,
    port,
    user,
    password,
  };
}

function readOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();

  return value ? value : undefined;
}

function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function extractEmailAddress(value: string): string {
  const sanitizedValue = sanitizeHeader(value);
  const addressMatch = sanitizedValue.match(/<([^<>]+)>/);

  return (addressMatch?.[1] ?? sanitizedValue).trim();
}

function formatAddress(value: string): string {
  return `<${sanitizeHeader(value)}>`;
}

function formatMailbox({ address, name }: { address: string; name?: string }) {
  const sanitizedName = name ? sanitizeHeader(name) : "";

  if (!sanitizedName) {
    return formatAddress(address);
  }

  return `${sanitizedName} ${formatAddress(address)}`;
}

function buildFromHeader({
  address,
  legacyFrom,
  name,
}: {
  address: string;
  legacyFrom?: string;
  name?: string;
}) {
  const sanitizedName = name ? sanitizeHeader(name) : "";
  const sanitizedLegacyFrom = legacyFrom ? sanitizeHeader(legacyFrom) : "";

  if (sanitizedName) {
    return formatMailbox({ address, name: sanitizedName });
  }

  if (sanitizedLegacyFrom.includes("<") && sanitizedLegacyFrom.includes(">")) {
    return sanitizedLegacyFrom;
  }

  return formatMailbox({ address });
}

function normalizeMessageBody(value: string): string {
  return value.replace(/\r?\n/g, "\r\n");
}

function buildMessage({
  from,
  html,
  to,
  subject,
  text,
}: {
  from: string;
  html?: string;
  to: string;
  subject: string;
  text: string;
}) {
  const headers = [
    `From: ${from}`,
    `To: ${formatAddress(to)}`,
    `Subject: ${sanitizeHeader(subject)}`,
    "MIME-Version: 1.0",
  ];

  if (html) {
    const boundary = `bienetre-${crypto.randomUUID()}`;

    return [
      ...headers,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      normalizeMessageBody(text),
      `--${boundary}`,
      "Content-Type: text/html; charset=utf-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      normalizeMessageBody(html),
      `--${boundary}--`,
    ].join("\r\n");
  }

  return [
    ...headers,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    normalizeMessageBody(text),
  ].join("\r\n");
}

class SmtpConnection {
  private buffer = "";

  constructor(
    private socket: net.Socket,
    private readonly host: string,
  ) {
    this.socket.setEncoding("utf8");
    this.socket.on("data", (chunk) => {
      this.buffer += chunk;
    });
  }

  async read(expectedCodes: string[]) {
    while (!this.hasCompleteResponse()) {
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          this.socket.off("data", onData);
          this.socket.off("error", onError);
          this.socket.off("end", onEnd);
        };
        const onData = () => {
          if (this.hasCompleteResponse()) {
            cleanup();
            resolve();
          }
        };
        const onError = (error: Error) => {
          cleanup();
          reject(error);
        };
        const onEnd = () => {
          cleanup();
          reject(new Error("Connexion SMTP fermée."));
        };

        this.socket.on("data", onData);
        this.socket.on("error", onError);
        this.socket.on("end", onEnd);
      });
    }

    const response = this.consumeResponse();
    const code = response.slice(0, 3);

    if (!expectedCodes.includes(code)) {
      throw new Error(`Réponse SMTP inattendue: ${response}`);
    }

    return response;
  }

  async command(command: string, expectedCodes: string[]) {
    this.socket.write(`${command}\r\n`);
    return this.read(expectedCodes);
  }

  async startTls() {
    await this.command("STARTTLS", ["220"]);
    this.socket = tls.connect({
      host: this.host,
      servername: this.host,
      socket: this.socket,
    });
    this.socket.setEncoding("utf8");
    this.socket.on("data", (chunk) => {
      this.buffer += chunk;
    });
    await new Promise<void>((resolve, reject) => {
      this.socket.once("secureConnect", resolve);
      this.socket.once("error", reject);
    });
  }

  close() {
    this.socket.end();
  }

  private hasCompleteResponse(): boolean {
    const lines = this.buffer.split(/\r?\n/).filter(Boolean);
    const lastLine = lines.at(-1);

    return lastLine !== undefined && /^\d{3} /.test(lastLine);
  }

  private consumeResponse(): string {
    const response = this.buffer.trimEnd();
    this.buffer = "";
    return response;
  }
}

function connectSmtp(config: SmtpConfig): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket =
      config.port === 465
        ? tls.connect({
            host: config.host,
            port: config.port,
            servername: config.host,
          })
        : net.connect({
            host: config.host,
            port: config.port,
          });

    socket.once(config.port === 465 ? "secureConnect" : "connect", () => {
      resolve(socket);
    });
    socket.once("error", reject);
  });
}

export async function sendSmtpEmail(email: SmtpEmail) {
  const config = readSmtpConfig();
  const socket = await connectSmtp(config);
  const connection = new SmtpConnection(socket, config.host);
  const message = buildMessage({
    from: config.fromHeader,
    html: email.html,
    subject: email.subject,
    text: email.text,
    to: email.to,
  });

  try {
    await connection.read(["220"]);
    await connection.command(`EHLO ${config.host}`, ["250"]);

    if (config.port !== 465) {
      await connection.startTls();
      await connection.command(`EHLO ${config.host}`, ["250"]);
    }

    await connection.command("AUTH LOGIN", ["334"]);
    await connection.command(Buffer.from(config.user).toString("base64"), ["334"]);
    await connection.command(
      Buffer.from(config.password).toString("base64"),
      ["235"],
    );
    await connection.command(`MAIL FROM:${formatAddress(config.envelopeFrom)}`, [
      "250",
    ]);
    await connection.command(`RCPT TO:${formatAddress(email.to)}`, ["250", "251"]);
    await connection.command("DATA", ["354"]);
    await connection.command(`${message}\r\n.`, ["250"]);
    await connection.command("QUIT", ["221"]);
  } finally {
    connection.close();
  }
}
