import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  ValidationPipe,
} from "@nestjs/common";
import type {
  CustomerAgeProfile,
  CustomerTrustedContactProjection,
} from "@stealth-trails-bank/types";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { CreateCustomerTrustedContactDto } from "./dto/create-customer-trusted-contact.dto";
import { UpdateCustomerAgeProfileDto } from "./dto/update-customer-age-profile.dto";
import { UpdateCustomerTrustedContactDto } from "./dto/update-customer-trusted-contact.dto";
import { UserService } from "./user.service";

@Controller("user")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(JwtAuthGuard)
  @Get(":id")
  async getUserById(
    @Param("id") id: string,
    @Req() req: { user: { id: string; sessionId?: string | null } },
  ): Promise<CustomJsonResponse> {
    const authenticatedUser = req.user;

    if (authenticatedUser.id !== id) {
      throw new UnauthorizedException(
        "You are not authorized to access this user",
      );
    }

    const user = await this.userService.getUserById(
      id,
      req.user.sessionId ?? null,
    );
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return {
      status: "success",
      message: "User retreived.",
      data: user,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":id/age-profile")
  async updateAgeProfile(
    @Param("id") id: string,
    @Body(new ValidationPipe()) dto: UpdateCustomerAgeProfileDto,
    @Req() req: { user: { id: string } },
  ): Promise<CustomJsonResponse<{ ageProfile: CustomerAgeProfile }>> {
    const authenticatedUser = req.user;

    if (authenticatedUser.id !== id) {
      throw new UnauthorizedException(
        "You are not authorized to update this user",
      );
    }

    const ageProfile = await this.userService.updateAgeProfile(id, {
      dateOfBirth: dto.dateOfBirth,
    });

    return {
      status: "success",
      message: "Age profile updated successfully.",
      data: {
        ageProfile,
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post(":id/trusted-contacts")
  async createTrustedContact(
    @Param("id") id: string,
    @Body(new ValidationPipe()) dto: CreateCustomerTrustedContactDto,
    @Req() req: { user: { id: string } },
  ): Promise<
    CustomJsonResponse<{ trustedContact: CustomerTrustedContactProjection }>
  > {
    const authenticatedUser = req.user;

    if (authenticatedUser.id !== id) {
      throw new UnauthorizedException(
        "You are not authorized to update this user",
      );
    }

    const trustedContact = await this.userService.createTrustedContact(id, dto);

    return {
      status: "success",
      message: "Trusted contact created successfully.",
      data: {
        trustedContact,
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":id/trusted-contacts/:contactId")
  async updateTrustedContact(
    @Param("id") id: string,
    @Param("contactId") contactId: string,
    @Body(new ValidationPipe()) dto: UpdateCustomerTrustedContactDto,
    @Req() req: { user: { id: string } },
  ): Promise<
    CustomJsonResponse<{ trustedContact: CustomerTrustedContactProjection }>
  > {
    const authenticatedUser = req.user;

    if (authenticatedUser.id !== id) {
      throw new UnauthorizedException(
        "You are not authorized to update this user",
      );
    }

    const trustedContact = await this.userService.updateTrustedContact(
      id,
      contactId,
      dto,
    );

    return {
      status: "success",
      message: "Trusted contact updated successfully.",
      data: {
        trustedContact,
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Delete(":id/trusted-contacts/:contactId")
  async removeTrustedContact(
    @Param("id") id: string,
    @Param("contactId") contactId: string,
    @Req() req: { user: { id: string } },
  ): Promise<CustomJsonResponse<{ removedTrustedContactId: string }>> {
    const authenticatedUser = req.user;

    if (authenticatedUser.id !== id) {
      throw new UnauthorizedException(
        "You are not authorized to update this user",
      );
    }

    const removedTrustedContactId = await this.userService.removeTrustedContact(
      id,
      contactId,
    );

    return {
      status: "success",
      message: "Trusted contact removed successfully.",
      data: {
        removedTrustedContactId,
      },
    };
  }
}
