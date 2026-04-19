import {
  Controller,
  Get,
  Query,
  Request,
  UseGuards,
  ValidationPipe
} from "@nestjs/common";
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { CustomerAccountIncidentPackageExportGovernanceService } from "./customer-account-incident-package-export-governance.service";
import { GetCustomerAccountComplianceExportDto } from "./dto/get-customer-account-compliance-export.dto";

type InternalOperatorRequest = {
  internalOperator: {
    operatorId: string;
    operatorRole?: string;
  };
};

@UseGuards(InternalOperatorBearerGuard)
@Controller("customer-account-incident-package/internal")
export class CustomerAccountIncidentPackageExportGovernanceController {
  constructor(
    private readonly customerAccountIncidentPackageExportGovernanceService: CustomerAccountIncidentPackageExportGovernanceService
  ) {}

  @Get("export")
  async getGovernedIncidentPackageExport(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: GetCustomerAccountComplianceExportDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.customerAccountIncidentPackageExportGovernanceService.getGovernedIncidentPackageExport(
        query,
        request.internalOperator.operatorId,
        request.internalOperator.operatorRole
      );

    return {
      status: "success",
      message: "Governed customer account incident package export generated successfully.",
      data: result
    };
  }

  @Get("export/markdown")
  async getGovernedIncidentPackageExportMarkdown(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: GetCustomerAccountComplianceExportDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.customerAccountIncidentPackageExportGovernanceService.getGovernedIncidentPackageExportMarkdown(
        query,
        request.internalOperator.operatorId,
        request.internalOperator.operatorRole
      );

    return {
      status: "success",
      message:
        "Governed customer account incident package markdown export generated successfully.",
      data: result
    };
  }
}
