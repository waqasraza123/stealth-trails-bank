import {
  Controller,
  Get,
  Query,
  UseGuards,
  ValidationPipe
} from "@nestjs/common";
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { CustomerAccountIncidentPackageService } from "./customer-account-incident-package.service";
import { GetCustomerAccountIncidentPackageDto } from "./dto/get-customer-account-incident-package.dto";

@UseGuards(InternalOperatorBearerGuard)
@Controller("customer-account-incident-package/internal")
export class CustomerAccountIncidentPackageController {
  constructor(
    private readonly customerAccountIncidentPackageService: CustomerAccountIncidentPackageService
  ) {}

  @Get()
  async getIncidentPackage(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: GetCustomerAccountIncidentPackageDto
  ): Promise<CustomJsonResponse> {
    const result =
      await this.customerAccountIncidentPackageService.buildIncidentPackage(
        query
      );

    return {
      status: "success",
      message: "Customer account incident package retrieved successfully.",
      data: result
    };
  }

  @Get("markdown")
  async getIncidentPackageMarkdown(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: GetCustomerAccountIncidentPackageDto
  ): Promise<CustomJsonResponse> {
    const incidentPackage =
      await this.customerAccountIncidentPackageService.buildIncidentPackage(
        query
      );
    const markdown =
      this.customerAccountIncidentPackageService.renderIncidentPackageMarkdown(
        incidentPackage
      );

    return {
      status: "success",
      message: "Customer account incident package markdown retrieved successfully.",
      data: {
        generatedAt: incidentPackage.generatedAt,
        customerAccountId: incidentPackage.customer.customerAccountId,
        markdown
      }
    };
  }
}
