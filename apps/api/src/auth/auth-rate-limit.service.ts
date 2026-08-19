import { HttpException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { customerAuthHmac } from "./customer-auth-crypto";

type RateLimitRule = {
  action: string;
  subject: string;
  limit: number;
  windowSeconds: number;
};

@Injectable()
export class AuthRateLimitService {
  constructor(private readonly prisma: PrismaService) {}

  private bucketStart(windowSeconds: number): Date {
    const windowMs = windowSeconds * 1000;
    return new Date(Math.floor(Date.now() / windowMs) * windowMs);
  }

  async assertAllowed(rule: RateLimitRule): Promise<void> {
    const windowStart = this.bucketStart(rule.windowSeconds);
    const bucket = await this.prisma.authRateLimitBucket.findUnique({
      where: {
        action_subjectHash_windowStart: {
          action: rule.action,
          subjectHash: customerAuthHmac(rule.subject),
          windowStart,
        },
      },
    });

    if (
      bucket &&
      (bucket.attemptCount >= rule.limit ||
        (bucket.blockedUntil && bucket.blockedUntil.getTime() > Date.now()))
    ) {
      const retryAfter = Math.max(
        1,
        Math.ceil(
          ((bucket.blockedUntil?.getTime() ??
            windowStart.getTime() + rule.windowSeconds * 1000) -
            Date.now()) /
            1000,
        ),
      );
      throw new HttpException(
        {
          status: "failed",
          message: "Too many authentication attempts. Try again later.",
          code: "AUTH_RATE_LIMITED",
          retryAfter,
        },
        429,
      );
    }
  }

  async recordFailure(rule: RateLimitRule): Promise<void> {
    const windowStart = this.bucketStart(rule.windowSeconds);
    const subjectHash = customerAuthHmac(rule.subject);
    const bucket = await this.prisma.authRateLimitBucket.upsert({
      where: {
        action_subjectHash_windowStart: {
          action: rule.action,
          subjectHash,
          windowStart,
        },
      },
      create: {
        action: rule.action,
        subjectHash,
        windowStart,
        attemptCount: 1,
      },
      update: {
        attemptCount: { increment: 1 },
      },
    });

    if (bucket.attemptCount >= rule.limit) {
      await this.prisma.authRateLimitBucket.update({
        where: { id: bucket.id },
        data: {
          blockedUntil: new Date(
            windowStart.getTime() + rule.windowSeconds * 1000,
          ),
        },
      });
    }
  }

  async clear(rule: RateLimitRule): Promise<void> {
    await this.prisma.authRateLimitBucket.deleteMany({
      where: {
        action: rule.action,
        subjectHash: customerAuthHmac(rule.subject),
      },
    });
  }
}
