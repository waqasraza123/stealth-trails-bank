import { PrismaClient } from "@prisma/client";

export class StealthTrailsPrismaClient extends PrismaClient {}

export function createStealthTrailsPrismaClient(): StealthTrailsPrismaClient {
  return new StealthTrailsPrismaClient();
}
