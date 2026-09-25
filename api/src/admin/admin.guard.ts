import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import type { AuthenticatedRequest } from "../auth/auth.guard";

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const allowed: UserRole[] = [UserRole.CONTENT_MANAGER, UserRole.ADMIN, UserRole.SUPER_ADMIN];
    if (!request.user || !allowed.includes(request.user.role)) throw new ForbiddenException("Admin access required");
    return true;
  }
}
