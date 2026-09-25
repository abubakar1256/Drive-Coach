import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { JWT_ACCESS_SECRET, type AuthPayload } from "./auth.service";

export type AuthenticatedRequest = Request & { user: AuthPayload };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const [scheme, token] = authorization?.split(" ") ?? [];
    if (scheme?.toLowerCase() !== "bearer" || !token) throw new UnauthorizedException("Bearer token required");

    try {
      request.user = this.jwtService.verify<AuthPayload>(token, { secret: JWT_ACCESS_SECRET });
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired access token");
    }
  }
}
