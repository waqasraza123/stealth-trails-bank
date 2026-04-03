import { Module } from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { PrismaService } from "../prisma/prisma.service";
import { AccountRestrictionReleaseReviewController } from "./account-restriction-release-review.controller";
import { AccountRestrictionReleaseReviewService } from "./account-restriction-release-review.service";
import { ManualResolutionReportingController } from "./manual-resolution-reporting.controller";
import { ManualResolutionReportingService } from "./manual-resolution-reporting.service";
import { ReviewCasesController } from "./review-cases.controller";
import { ReviewCasesService } from "./review-cases.service";

@Module({
  controllers: [
    ReviewCasesController,
    ManualResolutionReportingController,
    AccountRestrictionReleaseReviewController
  ],
  providers: [
    ReviewCasesService,
    ManualResolutionReportingService,
    AccountRestrictionReleaseReviewService,
    PrismaService,
    InternalOperatorApiKeyGuard
  ],
  exports: [ReviewCasesService]
})
export class ReviewCasesModule {}
