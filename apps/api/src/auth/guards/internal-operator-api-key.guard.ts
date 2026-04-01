import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";
import { loadInternalOperatorRuntimeConfig } from "@stealth-trails-bank/config/api";

type InternalOperatorRequest = {
  headers: Record<string, string | string[] | undefined>;
  internalOperator?: {
    operatorId: string;
  };
};

@Injectable()
export class InternalOperatorApiKeyGuard implements CanActivate {
  private readHeaderValue(
    request: InternalOperatorRequest,
    headerName: string
  ): string | null {
    const normalizedHeaderName = headerName.toLowerCase();
    const headerValue =
      request.headers[normalizedHeaderName] ?? request.headers[headerName];

    if (typeof headerValue === "string") {
      const normalizedHeaderValue = headerValue.trim();
      return normalizedHeaderValue ? normalizedHeaderValue : null;
    }

    if (Array.isArray(headerValue) && headerValue.length > 0) {
      const firstHeaderValue = headerValue[0]?.trim() ?? "";
      return firstHeaderValue ? firstHeaderValue : null;
    }

    return null;
  }

  private matchesApiKey(
    providedApiKey: string,
    configuredApiKey: string
  ): boolean {
    const providedBuffer = Buffer.from(providedApiKey);
    const configuredBuffer = Buffer.from(configuredApiKey);

    if (providedBuffer.length !== configuredBuffer.length) {
      return false;
    }

    return timingSafeEqual(providedBuffer, configuredBuffer);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<InternalOperatorRequest>();
    const providedApiKey = this.readHeaderValue(request, "x-operator-api-key");
    const operatorId = this.readHeaderValue(request, "x-operator-id");

    if (!providedApiKey) {
      throw new UnauthorizedException("Missing operator API key.");
    }

    if (!operatorId) {
      throw new UnauthorizedException("Missing operator id.");
    }

    const { internalOperatorApiKey } = loadInternalOperatorRuntimeConfig();

    if (!this.matchesApiKey(providedApiKey, internalOperatorApiKey)) {
      throw new UnauthorizedException("Invalid operator API key.");
    }

    request.internalOperator = {
      operatorId
    };

    return true;
  }
}
