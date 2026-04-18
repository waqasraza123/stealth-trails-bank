import {
  Controller,
  Post,
  Request,
  UseGuards
} from "@nestjs/common";
import { InternalWorkerApiKeyGuard } from "../auth/guards/internal-worker-api-key.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { SolvencyService } from "./solvency.service";

type InternalWorkerRequest = {
  internalWorker: {
    workerId: string;
  };
};

@UseGuards(InternalWorkerApiKeyGuard)
@Controller("solvency/internal/worker")
export class SolvencyWorkerController {
  constructor(private readonly solvencyService: SolvencyService) {}

  @Post("snapshots/run")
  async runSnapshot(
    @Request() request: InternalWorkerRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.solvencyService.generateSnapshot({
      actorType: "worker",
      actorId: request.internalWorker.workerId
    });

    return {
      status: "success",
      message: "Worker-triggered solvency snapshot generated successfully.",
      data: result
    };
  }
}
