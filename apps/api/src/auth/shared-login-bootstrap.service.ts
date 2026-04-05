import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { AuthService } from "./auth.service";

@Injectable()
export class SharedLoginBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SharedLoginBootstrapService.name);

  constructor(private readonly authService: AuthService) {}

  async onApplicationBootstrap(): Promise<void> {
    const result = await this.authService.ensureSharedLoginAccount();

    if (!result) {
      this.logger.log("Shared login bootstrap is disabled.");
      return;
    }

    this.logger.log(
      `Shared login account is ready for ${result.email} (${result.supabaseUserId}).`
    );
  }
}
