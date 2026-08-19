import { Global, Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";
import { SharedLoginBootstrapService } from "./shared-login-bootstrap.service";
import { OperatorIdentityService } from "./operator-identity.service";
import { InternalOperatorApiKeyGuard } from "./guards/internal-operator-api-key.guard";
import { InternalOperatorBearerGuard } from "./guards/internal-operator-bearer.guard";
import { PlatformAlertDeliveryService } from "../operations-monitoring/platform-alert-delivery.service";
import { ReviewCasesModule } from "../review-cases/review-cases.module";
import { CustomerMfaEmailDeliveryService } from "./customer-mfa-email-delivery.service";
import { CustomerSecurityEmailDeliveryService } from "./customer-security-email-delivery.service";
import { PasswordSecurityService } from "./password-security.service";
import { AuthRateLimitService } from "./auth-rate-limit.service";

@Global()
@Module({
  imports: [ReviewCasesModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    PrismaService,
    JwtAuthGuard,
    SharedLoginBootstrapService,
    OperatorIdentityService,
    InternalOperatorApiKeyGuard,
    InternalOperatorBearerGuard,
    PlatformAlertDeliveryService,
    CustomerMfaEmailDeliveryService,
    CustomerSecurityEmailDeliveryService,
    PasswordSecurityService,
    AuthRateLimitService,
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    OperatorIdentityService,
    InternalOperatorApiKeyGuard,
    InternalOperatorBearerGuard,
  ],
})
export class AuthModule {}
