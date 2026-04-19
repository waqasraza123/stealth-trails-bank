import {
  Controller,
  Get,
  Query,
  UseGuards,
  ValidationPipe
} from "@nestjs/common";
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { GetTreasuryOverviewDto } from "./dto/get-treasury-overview.dto";
import { TreasuryService } from "./treasury.service";

@UseGuards(InternalOperatorBearerGuard)
@Controller("treasury/internal")
export class TreasuryController {
  constructor(private readonly treasuryService: TreasuryService) {}

  @Get("overview")
  async getTreasuryOverview(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: GetTreasuryOverviewDto
  ): Promise<CustomJsonResponse> {
    const result = await this.treasuryService.getTreasuryOverview(query);

    return {
      status: "success",
      message: "Treasury overview retrieved successfully.",
      data: result
    };
  }
}
