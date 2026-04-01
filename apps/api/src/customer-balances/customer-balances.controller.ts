import { Controller, Get, Request, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { CustomerBalancesService } from "./customer-balances.service";

type AuthenticatedRequest = {
  user: {
    id: string;
  };
};

@UseGuards(JwtAuthGuard)
@Controller("balances")
export class CustomerBalancesController {
  constructor(
    private readonly customerBalancesService: CustomerBalancesService
  ) {}

  @Get("me")
  async listMyBalances(
    @Request() request: AuthenticatedRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.customerBalancesService.listMyBalances(
      request.user.id
    );

    return {
      status: "success",
      message: "Customer balances retrieved successfully.",
      data: result
    };
  }
}
