import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { SupportedAssetsService } from "./supported-assets.service";

@UseGuards(JwtAuthGuard)
@Controller("assets")
export class SupportedAssetsController {
  constructor(
    private readonly supportedAssetsService: SupportedAssetsService
  ) {}

  @Get("supported")
  async listSupportedAssets(): Promise<CustomJsonResponse> {
    const result = await this.supportedAssetsService.listSupportedAssets();

    return {
      status: "success",
      message: "Supported assets retrieved successfully.",
      data: result
    };
  }
}
