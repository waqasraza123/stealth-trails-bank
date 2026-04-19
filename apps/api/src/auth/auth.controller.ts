import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UnauthorizedException,
  UseGuards,
  ValidationPipe,
} from "@nestjs/common";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { InternalOperatorBearerGuard } from "./guards/internal-operator-bearer.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { AuthService } from "./auth.service";
import { ListCustomerMfaRecoveryRequestsDto } from "./dto/list-customer-mfa-recovery-requests.dto";
import { LoginDto } from "./dto/login.dto";
import {
  ApproveCustomerMfaRecoveryDto,
  ExecuteCustomerMfaRecoveryDto,
  RejectCustomerMfaRecoveryDto,
} from "./dto/review-customer-mfa-recovery.dto";
import { RequestCustomerMfaRecoveryDto } from "./dto/request-customer-mfa-recovery.dto";
import { SignUpDto } from "./dto/sign-up.dto";
import { StartMfaChallengeDto } from "./dto/start-mfa-challenge.dto";
import { UpdatePasswordDto } from "./dto/update-password.dto";
import { VerifyEmailEnrollmentDto } from "./dto/verify-email-enrollment.dto";
import { VerifyEmailRecoveryDto } from "./dto/verify-email-recovery.dto";
import { VerifyMfaChallengeDto } from "./dto/verify-mfa-challenge.dto";
import { VerifyTotpEnrollmentDto } from "./dto/verify-totp-enrollment.dto";

type AuthenticatedRequest = {
  user: {
    id: string;
  };
};

type AuthenticatedOperatorRequest = {
  internalOperator: {
    operatorId: string;
    operatorRole?: string | null;
    operatorDbId?: string | null;
    operatorRoles?: string[];
    operatorSupabaseUserId?: string | null;
    operatorEmail?: string | null;
    authSource?: "supabase_jwt" | "legacy_api_key";
    environment?: string | null;
    sessionCorrelationId?: string | null;
  };
};

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post(["signup", "signUp"])
  async signUp(
    @Body(new ValidationPipe()) signUpDto: SignUpDto,
  ): Promise<CustomJsonResponse> {
    return this.authService.signUp(
      signUpDto.firstName,
      signUpDto.lastName,
      signUpDto.email,
      signUpDto.password,
    );
  }

  @Post("login")
  async login(
    @Body(new ValidationPipe()) loginDto: LoginDto,
  ): Promise<CustomJsonResponse> {
    return this.authService.login(loginDto.email, loginDto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("password")
  async updatePassword(
    @Body(new ValidationPipe()) updatePasswordDto: UpdatePasswordDto,
    @Request() request: AuthenticatedRequest,
  ): Promise<CustomJsonResponse> {
    return this.authService.updatePassword(
      request.user.id,
      updatePasswordDto.currentPassword,
      updatePasswordDto.newPassword,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post("session/revoke-all")
  async revokeAllCustomerSessions(
    @Request() request: AuthenticatedRequest,
  ): Promise<CustomJsonResponse> {
    return this.authService.revokeAllCustomerSessions(request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get("mfa/status")
  async getMfaStatus(
    @Request() request: AuthenticatedRequest,
  ): Promise<CustomJsonResponse> {
    return this.authService.getCustomerMfaStatus(request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post("mfa/totp/enrollment/start")
  async startTotpEnrollment(
    @Request() request: AuthenticatedRequest,
  ): Promise<CustomJsonResponse> {
    return this.authService.startTotpEnrollment(request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post("mfa/totp/enrollment/verify")
  async verifyTotpEnrollment(
    @Body(new ValidationPipe()) dto: VerifyTotpEnrollmentDto,
    @Request() request: AuthenticatedRequest,
  ): Promise<CustomJsonResponse> {
    return this.authService.verifyTotpEnrollment(request.user.id, dto.code);
  }

  @UseGuards(JwtAuthGuard)
  @Post("mfa/email/enrollment/start")
  async startEmailEnrollment(
    @Request() request: AuthenticatedRequest,
  ): Promise<CustomJsonResponse> {
    return this.authService.startEmailEnrollment(request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post("mfa/email/enrollment/verify")
  async verifyEmailEnrollment(
    @Body(new ValidationPipe()) dto: VerifyEmailEnrollmentDto,
    @Request() request: AuthenticatedRequest,
  ): Promise<CustomJsonResponse> {
    return this.authService.verifyEmailEnrollment(
      request.user.id,
      dto.challengeId,
      dto.code,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post("mfa/recovery/email/start")
  async startEmailRecovery(
    @Request() request: AuthenticatedRequest,
  ): Promise<CustomJsonResponse> {
    return this.authService.startEmailRecovery(request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post("mfa/recovery/email/verify")
  async verifyEmailRecovery(
    @Body(new ValidationPipe()) dto: VerifyEmailRecoveryDto,
    @Request() request: AuthenticatedRequest,
  ): Promise<CustomJsonResponse> {
    return this.authService.verifyEmailRecovery(
      request.user.id,
      dto.challengeId,
      dto.code,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post("mfa/challenge/start")
  async startMfaChallenge(
    @Body(new ValidationPipe()) dto: StartMfaChallengeDto,
    @Request() request: AuthenticatedRequest,
  ): Promise<CustomJsonResponse> {
    return this.authService.startMfaChallenge(
      request.user.id,
      dto.purpose,
      dto.method,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post("mfa/challenge/verify")
  async verifyMfaChallenge(
    @Body(new ValidationPipe()) dto: VerifyMfaChallengeDto,
    @Request() request: AuthenticatedRequest,
  ): Promise<CustomJsonResponse> {
    return this.authService.verifyMfaChallenge(
      request.user.id,
      dto.challengeId,
      dto.purpose,
      dto.method,
      dto.code,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get("internal/customer-account/:supabaseUserId")
  async getCustomerAccountProjection(
    @Param("supabaseUserId") supabaseUserId: string,
    @Request() request: AuthenticatedRequest,
  ): Promise<CustomJsonResponse> {
    if (request.user.id !== supabaseUserId) {
      throw new UnauthorizedException(
        "You are not authorized to access this customer account.",
      );
    }

    const projection =
      await this.authService.getCustomerAccountProjectionBySupabaseUserId(
        supabaseUserId,
      );

    return {
      status: "success",
      message: "Customer account projection retrieved successfully.",
      data: projection,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get("internal/customer-wallet/:supabaseUserId")
  async getCustomerWalletProjection(
    @Param("supabaseUserId") supabaseUserId: string,
    @Request() request: AuthenticatedRequest,
  ): Promise<CustomJsonResponse> {
    if (request.user.id !== supabaseUserId) {
      throw new UnauthorizedException(
        "You are not authorized to access this customer wallet.",
      );
    }

    const projection =
      await this.authService.getCustomerWalletProjectionBySupabaseUserId(
        supabaseUserId,
      );

    return {
      status: "success",
      message: "Customer wallet projection retrieved successfully.",
      data: projection,
    };
  }

  @UseGuards(InternalOperatorBearerGuard)
  @Get("internal/operator/session")
  async getOperatorSession(
    @Request() request: AuthenticatedOperatorRequest,
  ): Promise<CustomJsonResponse> {
    return {
      status: "success",
      message: "Operator session resolved successfully.",
      data: {
        operatorId: request.internalOperator.operatorId,
        operatorRole: request.internalOperator.operatorRole ?? null,
        operatorRoles: request.internalOperator.operatorRoles ?? [],
        operatorDbId: request.internalOperator.operatorDbId ?? null,
        operatorSupabaseUserId:
          request.internalOperator.operatorSupabaseUserId ?? null,
        operatorEmail: request.internalOperator.operatorEmail ?? null,
        authSource: request.internalOperator.authSource ?? "legacy_api_key",
        environment: request.internalOperator.environment ?? null,
        sessionCorrelationId:
          request.internalOperator.sessionCorrelationId ?? null,
      },
    };
  }

  @UseGuards(InternalOperatorBearerGuard)
  @Get("internal/customer-mfa-recovery-requests")
  async listCustomerMfaRecoveryRequests(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    query: ListCustomerMfaRecoveryRequestsDto,
  ): Promise<CustomJsonResponse> {
    const result =
      await this.authService.listCustomerMfaRecoveryRequests(query);

    return {
      status: "success",
      message: "Customer MFA recovery requests retrieved successfully.",
      data: result,
    };
  }

  @UseGuards(InternalOperatorBearerGuard)
  @Post("internal/customer-mfa-recovery/:supabaseUserId/request")
  async requestCustomerMfaRecovery(
    @Param("supabaseUserId") supabaseUserId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    dto: RequestCustomerMfaRecoveryDto,
    @Request() request: AuthenticatedOperatorRequest,
  ): Promise<CustomJsonResponse> {
    const result = await this.authService.requestCustomerMfaRecovery(
      supabaseUserId,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole ?? null,
      dto,
    );

    return {
      status: "success",
      message: result.stateReused
        ? "Customer MFA recovery request reused successfully."
        : "Customer MFA recovery request created successfully.",
      data: result,
    };
  }

  @UseGuards(InternalOperatorBearerGuard)
  @Post("internal/customer-mfa-recovery-requests/:requestId/approve")
  async approveCustomerMfaRecoveryRequest(
    @Param("requestId") requestId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    dto: ApproveCustomerMfaRecoveryDto,
    @Request() request: AuthenticatedOperatorRequest,
  ): Promise<CustomJsonResponse> {
    const result = await this.authService.approveCustomerMfaRecoveryRequest(
      requestId,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole ?? null,
      dto.note,
    );

    return {
      status: "success",
      message: result.stateReused
        ? "Customer MFA recovery approval reused successfully."
        : "Customer MFA recovery request approved successfully.",
      data: result,
    };
  }

  @UseGuards(InternalOperatorBearerGuard)
  @Post("internal/customer-mfa-recovery-requests/:requestId/reject")
  async rejectCustomerMfaRecoveryRequest(
    @Param("requestId") requestId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    dto: RejectCustomerMfaRecoveryDto,
    @Request() request: AuthenticatedOperatorRequest,
  ): Promise<CustomJsonResponse> {
    const result = await this.authService.rejectCustomerMfaRecoveryRequest(
      requestId,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole ?? null,
      dto.note,
    );

    return {
      status: "success",
      message: result.stateReused
        ? "Customer MFA recovery rejection reused successfully."
        : "Customer MFA recovery request rejected successfully.",
      data: result,
    };
  }

  @UseGuards(InternalOperatorBearerGuard)
  @Post("internal/customer-mfa-recovery-requests/:requestId/execute")
  async executeCustomerMfaRecoveryRequest(
    @Param("requestId") requestId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    dto: ExecuteCustomerMfaRecoveryDto,
    @Request() request: AuthenticatedOperatorRequest,
  ): Promise<CustomJsonResponse> {
    const result = await this.authService.executeCustomerMfaRecoveryRequest(
      requestId,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole ?? null,
      dto.note,
    );

    return {
      status: "success",
      message: result.stateReused
        ? "Customer MFA recovery execution reused successfully."
        : "Customer MFA recovery request executed successfully.",
      data: result,
    };
  }
}
