import crypto from "node:crypto";

export type SigningPurpose =
  | "session"
  | "password-reset-token"
  | "password-reset-code"
  | "password-reset-version";

export class SigningConfigurationError extends Error {
  constructor() {
    super("Authentication signing is not configured securely.");
    this.name = "SigningConfigurationError";
  }
}

const PLACEHOLDER =
  /(?:dev.secret|change.?me|change.in.prod|your[_ -]|example|placeholder|default|password)/i;

function usableSecret(
  value: string | undefined,
  minimumLength: number,
): value is string {
  return (
    !!value &&
    value.trim().length >= minimumLength &&
    !PLACEHOLDER.test(value) &&
    !/^(.)\1+$/.test(value)
  );
}

/** Derive separate application keys without exposing or reusing a provider credential directly. */
export function getSigningKey(purpose: SigningPurpose): Buffer {
  const dedicated = process.env.NC_SESSION_SECRET;
  // An explicitly configured weak key is a configuration error, never a silent fallback.
  if (dedicated !== undefined && dedicated !== "") {
    if (!usableSecret(dedicated, 32)) throw new SigningConfigurationError();
    // Retain the HMAC algorithm/key for installations already using a strong dedicated key.
    if (purpose === "session") return Buffer.from(dedicated, "utf8");
    return Buffer.from(
      crypto.hkdfSync("sha256", dedicated, "mindverse-signing-v2", purpose, 32),
    );
  }

  const cronSecret = process.env.CRON_SECRET?.trim();
  const cloudinarySecret = process.env.CLOUDINARY_API_SECRET?.trim();
  const source = usableSecret(cronSecret, 32)
    ? cronSecret
    : usableSecret(cloudinarySecret, 20)
      ? cloudinarySecret
      : null;
  if (!source) throw new SigningConfigurationError();
  return Buffer.from(
    crypto.hkdfSync("sha256", source, "mindverse-signing-v2", purpose, 32),
  );
}
