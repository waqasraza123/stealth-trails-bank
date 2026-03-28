import { Injectable } from "@nestjs/common";
import { StealthTrailsPrismaClient } from "@stealth-trails-bank/db";

@Injectable()
export class PrismaService extends StealthTrailsPrismaClient {}
