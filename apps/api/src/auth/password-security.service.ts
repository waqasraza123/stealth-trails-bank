import { Injectable } from "@nestjs/common";
import { hash, verify, Algorithm } from "@node-rs/argon2";
import * as bcrypt from "bcryptjs";

const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

const DUMMY_PASSWORD_HASH =
  "$2a$12$C6UzMDM.H6dfI/f/IKcEe.5dLa1YfCPR1x3I3g7e8sXK3fG7Wue4a";

@Injectable()
export class PasswordSecurityService {
  hash(password: string): Promise<string> {
    return hash(password.normalize("NFC"), ARGON2_OPTIONS);
  }

  async verify(passwordHash: string, password: string): Promise<{
    valid: boolean;
    legacyHash: boolean;
  }> {
    const normalizedPassword = password.normalize("NFC");

    if (passwordHash.startsWith("$argon2id$")) {
      return {
        valid: await verify(passwordHash, normalizedPassword, ARGON2_OPTIONS),
        legacyHash: false,
      };
    }

    if (passwordHash.startsWith("$2")) {
      const normalizedMatch = await bcrypt.compare(
        normalizedPassword,
        passwordHash,
      );
      const rawMatch =
        normalizedPassword === password
          ? normalizedMatch
          : await bcrypt.compare(password, passwordHash);

      return {
        valid: normalizedMatch || rawMatch,
        legacyHash: true,
      };
    }

    return { valid: false, legacyHash: false };
  }

  async consumeDummyVerification(password: string): Promise<void> {
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
  }
}
