import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { loadCustomerAuthSecurityRuntimeConfig } from "@stealth-trails-bank/config/api";

export function customerAuthHmac(value: string): string {
  const { hmacPepper } = loadCustomerAuthSecurityRuntimeConfig();
  return createHmac("sha256", hmacPepper).update(value).digest("hex");
}

export function customerAuthHmacMatches(value: string, expected: string): boolean {
  const receivedBuffer = Buffer.from(customerAuthHmac(value), "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

export function generateOpaqueToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

export function generateEmailVerificationCode(): string {
  return String(randomBytes(4).readUInt32BE(0) % 100_000_000).padStart(8, "0");
}

export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(10).toString("base64url").toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5, 10)}-${raw.slice(10, 15)}`;
  });
}

export function encryptCustomerAuthSecret(value: string): {
  ciphertext: string;
  keyVersion: string;
} {
  const { encryptionKey, encryptionKeyVersion } =
    loadCustomerAuthSecurityRuntimeConfig();
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    Buffer.from(encryptionKey, "base64"),
    iv,
  );
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: Buffer.concat([iv, tag, encrypted]).toString("base64"),
    keyVersion: encryptionKeyVersion,
  };
}

export function decryptCustomerAuthSecret(
  ciphertext: string,
  keyVersion: string,
): string {
  const config = loadCustomerAuthSecurityRuntimeConfig();

  if (keyVersion !== config.encryptionKeyVersion) {
    throw new Error(`Unsupported customer authentication key version: ${keyVersion}`);
  }

  const payload = Buffer.from(ciphertext, "base64");
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(config.encryptionKey, "base64"),
    iv,
  );
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8",
  );
}
