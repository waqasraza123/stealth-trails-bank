import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UnauthorizedException,
  UseGuards,
  ValidationPipe
} from "@nestjs/common";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { SignUpDto } from "./dto/sign-up.dto";
import { UpdatePasswordDto } from "./dto/update-password.dto";

type AuthenticatedRequest = {
  user: {
    id: string;
  };
};

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post(["signup", "signUp"])
  async signUp(
    @Body(new ValidationPipe()) signUpDto: SignUpDto
  ): Promise<CustomJsonResponse> {
    return this.authService.signUp(
      signUpDto.firstName,
      signUpDto.lastName,
      signUpDto.email,
      signUpDto.password
    );
  }

  @Post("login")
  async login(
    @Body(new ValidationPipe()) loginDto: LoginDto
  ): Promise<CustomJsonResponse> {
    return this.authService.login(loginDto.email, loginDto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("password")
  async updatePassword(
    @Body(new ValidationPipe()) updatePasswordDto: UpdatePasswordDto,
    @Request() request: AuthenticatedRequest
  ): Promise<CustomJsonResponse> {
    return this.authService.updatePassword(
      request.user.id,
      updatePasswordDto.currentPassword,
      updatePasswordDto.newPassword
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get("internal/customer-account/:supabaseUserId")
  async getCustomerAccountProjection(
    @Param("supabaseUserId") supabaseUserId: string,
    @Request() request: AuthenticatedRequest
  ): Promise<CustomJsonResponse> {
    if (request.user.id !== supabaseUserId) {
      throw new UnauthorizedException(
        "You are not authorized to access this customer account."
      );
    }

    const projection =
      await this.authService.getCustomerAccountProjectionBySupabaseUserId(
        supabaseUserId
      );

    return {
      status: "success",
      message: "Customer account projection retrieved successfully.",
      data: projection
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get("internal/customer-wallet/:supabaseUserId")
  async getCustomerWalletProjection(
    @Param("supabaseUserId") supabaseUserId: string,
    @Request() request: AuthenticatedRequest
  ): Promise<CustomJsonResponse> {
    if (request.user.id !== supabaseUserId) {
      throw new UnauthorizedException(
        "You are not authorized to access this customer wallet."
      );
    }

    const projection =
      await this.authService.getCustomerWalletProjectionBySupabaseUserId(
        supabaseUserId
      );

    return {
      status: "success",
      message: "Customer wallet projection retrieved successfully.",
      data: projection
    };
  }
}
