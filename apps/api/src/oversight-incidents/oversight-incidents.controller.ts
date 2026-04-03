import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
  ValidationPipe
} from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { AddOversightIncidentNoteDto } from "./dto/add-oversight-incident-note.dto";
import { ApplyAccountRestrictionDto } from "./dto/apply-account-restriction.dto";
import { DismissOversightIncidentDto } from "./dto/dismiss-oversight-incident.dto";
import { GetOversightIncidentWorkspaceDto } from "./dto/get-oversight-incident-workspace.dto";
import { ListOversightAlertsDto } from "./dto/list-oversight-alerts.dto";
import { ListOversightIncidentsDto } from "./dto/list-oversight-incidents.dto";
import { OpenCustomerOversightIncidentDto } from "./dto/open-customer-oversight-incident.dto";
import { OpenOperatorOversightIncidentDto } from "./dto/open-operator-oversight-incident.dto";
import { ResolveOversightIncidentDto } from "./dto/resolve-oversight-incident.dto";
import { StartOversightIncidentDto } from "./dto/start-oversight-incident.dto";
import { OversightIncidentsService } from "./oversight-incidents.service";

type InternalOperatorRequest = {
  internalOperator: {
    operatorId: string;
    operatorRole?: string;
  };
};

@UseGuards(InternalOperatorApiKeyGuard)
@Controller("oversight-incidents/internal")
export class OversightIncidentsController {
  constructor(
    private readonly oversightIncidentsService: OversightIncidentsService
  ) {}

  @Get("alerts")
  async listOversightAlerts(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListOversightAlertsDto
  ): Promise<CustomJsonResponse> {
    const result = await this.oversightIncidentsService.listOversightAlerts(
      query
    );

    return {
      status: "success",
      message: "Oversight alerts retrieved successfully.",
      data: result
    };
  }

  @Post("customer/:customerAccountId/open")
  async openCustomerOversightIncident(
    @Param("customerAccountId") customerAccountId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: OpenCustomerOversightIncidentDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.oversightIncidentsService.openCustomerOversightIncident(
        customerAccountId,
        request.internalOperator.operatorId,
        dto
      );

    return {
      status: "success",
      message: result.oversightIncidentReused
        ? "Customer oversight incident reused successfully."
        : "Customer oversight incident opened successfully.",
      data: result
    };
  }

  @Post("operator/:subjectOperatorId/open")
  async openOperatorOversightIncident(
    @Param("subjectOperatorId") subjectOperatorId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: OpenOperatorOversightIncidentDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.oversightIncidentsService.openOperatorOversightIncident(
        subjectOperatorId,
        request.internalOperator.operatorId,
        dto
      );

    return {
      status: "success",
      message: result.oversightIncidentReused
        ? "Operator oversight incident reused successfully."
        : "Operator oversight incident opened successfully.",
      data: result
    };
  }

  @Get()
  async listOversightIncidents(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListOversightIncidentsDto
  ): Promise<CustomJsonResponse> {
    const result = await this.oversightIncidentsService.listOversightIncidents(
      query
    );

    return {
      status: "success",
      message: "Oversight incidents retrieved successfully.",
      data: result
    };
  }

  @Get(":oversightIncidentId")
  async getOversightIncident(
    @Param("oversightIncidentId") oversightIncidentId: string
  ): Promise<CustomJsonResponse> {
    const result = await this.oversightIncidentsService.getOversightIncident(
      oversightIncidentId
    );

    return {
      status: "success",
      message: "Oversight incident retrieved successfully.",
      data: result
    };
  }

  @Get(":oversightIncidentId/workspace")
  async getOversightIncidentWorkspace(
    @Param("oversightIncidentId") oversightIncidentId: string,
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: GetOversightIncidentWorkspaceDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.oversightIncidentsService.getOversightIncidentWorkspace(
        oversightIncidentId,
        query,
        request.internalOperator.operatorRole
      );

    return {
      status: "success",
      message: "Oversight incident workspace retrieved successfully.",
      data: result
    };
  }

  @Post(":oversightIncidentId/start")
  async startOversightIncident(
    @Param("oversightIncidentId") oversightIncidentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: StartOversightIncidentDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.oversightIncidentsService.startOversightIncident(
      oversightIncidentId,
      request.internalOperator.operatorId,
      dto
    );

    return {
      status: "success",
      message: result.stateReused
        ? "Oversight incident start state reused successfully."
        : "Oversight incident started successfully.",
      data: result
    };
  }

  @Post(":oversightIncidentId/notes")
  async addOversightIncidentNote(
    @Param("oversightIncidentId") oversightIncidentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: AddOversightIncidentNoteDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.oversightIncidentsService.addOversightIncidentNote(
        oversightIncidentId,
        request.internalOperator.operatorId,
        dto
      );

    return {
      status: "success",
      message: "Oversight incident note added successfully.",
      data: result
    };
  }

  @Post(":oversightIncidentId/place-account-hold")
  async applyAccountRestriction(
    @Param("oversightIncidentId") oversightIncidentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: ApplyAccountRestrictionDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.oversightIncidentsService.applyAccountRestriction(
      oversightIncidentId,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole,
      dto
    );

    return {
      status: "success",
      message: result.stateReused
        ? "Account hold state reused successfully."
        : "Account hold placed successfully.",
      data: result
    };
  }

  @Post(":oversightIncidentId/resolve")
  async resolveOversightIncident(
    @Param("oversightIncidentId") oversightIncidentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: ResolveOversightIncidentDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.oversightIncidentsService.resolveOversightIncident(
      oversightIncidentId,
      request.internalOperator.operatorId,
      dto
    );

    return {
      status: "success",
      message: result.stateReused
        ? "Oversight incident resolve state reused successfully."
        : "Oversight incident resolved successfully.",
      data: result
    };
  }

  @Post(":oversightIncidentId/dismiss")
  async dismissOversightIncident(
    @Param("oversightIncidentId") oversightIncidentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: DismissOversightIncidentDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.oversightIncidentsService.dismissOversightIncident(
      oversightIncidentId,
      request.internalOperator.operatorId,
      dto
    );

    return {
      status: "success",
      message: result.stateReused
        ? "Oversight incident dismiss state reused successfully."
        : "Oversight incident dismissed successfully.",
      data: result
    };
  }
}
