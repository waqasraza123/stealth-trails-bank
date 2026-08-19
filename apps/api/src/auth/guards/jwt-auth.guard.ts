import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { AuthService } from "../auth.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers["authorization"] as string | undefined;
    const cookieHeader = request.headers["cookie"] as string | undefined;

    if (authHeader) {
      const [scheme, token, extra] = authHeader.trim().split(/\s+/u);

      if (scheme !== "Bearer" || !token || extra) {
        throw new UnauthorizedException("Authorization header is invalid.");
      }

      request.user = {
        ...(await this.authService.validateToken(token)),
        authMode: "bearer",
      };
      return true;
    }

    const cookieName =
      process.env.NODE_ENV === "production"
        ? "__Host-stb_session"
        : "stb_session";
    const sessionToken = cookieHeader
      ?.split(";")
      .map((part) => part.trim().split("="))
      .find(([name]) => name === cookieName)?.[1];

    if (!sessionToken) {
      throw new UnauthorizedException("Customer session is missing.");
    }

    request.user = await this.authService.validateWebSession(
      decodeURIComponent(sessionToken),
    );

    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      const csrfToken = request.headers["x-csrf-token"] as string | undefined;
      if (!csrfToken) {
        throw new UnauthorizedException("CSRF token is missing.");
      }
      await this.authService.assertWebCsrfToken(
        request.user.sessionId,
        csrfToken,
      );
    }

    return true;
  }
}
