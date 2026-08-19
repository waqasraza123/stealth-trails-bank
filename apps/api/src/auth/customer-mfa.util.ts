import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { customerAuthHmac } from "./customer-auth-crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function createOtpHash(value: string): string {
  return customerAuthHmac(`otp:${value}`);
}

export function otpHashMatches(value: string, expectedHash: string): boolean {
  const received = Buffer.from(createOtpHash(value));
  const expected = Buffer.from(expectedHash);

  if (received.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(received, expected);
}

export function generateEmailOtpCode(): string {
  return String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, "0");
}

export function generateBase32Secret(byteLength = 20): string {
  const bytes = randomBytes(byteLength);
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function decodeBase32Secret(secret: string): Buffer {
  const normalized = secret.replace(/=+$/u, "").replace(/\s+/gu, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);

    if (index === -1) {
      throw new Error("Invalid base32 secret.");
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

function generateHotp(secret: string, counter: number): string {
  const key = decodeBase32Secret(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuffer.writeUInt32BE(counter >>> 0, 4);

  const hmac = createHmac("sha1", key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(code % 1_000_000).padStart(6, "0");
}

export function findValidTotpCounter(
  secret: string,
  code: string,
  window = 1,
  stepSeconds = 30,
  now = Date.now()
): number | null {
  if (!/^\d{6}$/u.test(code)) {
    return null;
  }

  const counter = Math.floor(now / 1000 / stepSeconds);

  for (let offset = -window; offset <= window; offset += 1) {
    if (generateHotp(secret, counter + offset) === code) {
      return counter + offset;
    }
  }

  return null;
}

export function verifyTotpCode(
  secret: string,
  code: string,
  window = 1,
  stepSeconds = 30,
  now = Date.now(),
): boolean {
  return findValidTotpCounter(secret, code, window, stepSeconds, now) !== null;
}

export function buildOtpAuthUri(
  email: string,
  secret: string,
  issuer = "Stealth Trails Bank"
): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedSecret = encodeURIComponent(secret);

  return `otpauth://totp/${label}?secret=${encodedSecret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}
