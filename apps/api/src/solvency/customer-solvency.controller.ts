import { Controller, Get, Query, Request, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { SolvencyService } from "./solvency.service";

type AuthenticatedRequest = {
  user: {
    id: string;
  };
};

@UseGuards(JwtAuthGuard)
@Controller("solvency")
export class CustomerSolvencyController {
  constructor(private readonly solvencyService: SolvencyService) {}

  @Get("me/liability-proof")
  async getMyLiabilityProof(
    @Request() request: AuthenticatedRequest,
    @Query("snapshotId") snapshotId?: string
  ): Promise<CustomJsonResponse> {
    const result = await this.solvencyService.getCustomerLiabilityInclusionProof(
      request.user.id,
      snapshotId
    );

    return {
      status: "success",
      message: "Customer solvency liability proof retrieved successfully.",
      data: result
    };
  }
}
