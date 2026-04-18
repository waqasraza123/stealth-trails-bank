import { Controller, Get, Param, Query, ValidationPipe } from "@nestjs/common";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { GetPublicSolvencyReportsDto } from "./dto/get-public-solvency-reports.dto";
import { SolvencyService } from "./solvency.service";

@Controller("solvency/public")
export class SolvencyPublicController {
  constructor(private readonly solvencyService: SolvencyService) {}

  @Get("reports")
  async listReports(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: GetPublicSolvencyReportsDto
  ): Promise<CustomJsonResponse> {
    const result = await this.solvencyService.listPublicReports(query.limit);

    return {
      status: "success",
      message: "Public solvency reports retrieved successfully.",
      data: result
    };
  }

  @Get("reports/latest")
  async getLatestReport(): Promise<CustomJsonResponse> {
    const result = await this.solvencyService.getLatestPublicReport();

    return {
      status: "success",
      message: "Latest signed solvency report retrieved successfully.",
      data: result
    };
  }

  @Get("reports/:snapshotId")
  async getReportBySnapshotId(
    @Param("snapshotId") snapshotId: string
  ): Promise<CustomJsonResponse> {
    const result = await this.solvencyService.getPublicReportBySnapshotId(snapshotId);

    return {
      status: "success",
      message: "Signed solvency report retrieved successfully.",
      data: result
    };
  }
}
