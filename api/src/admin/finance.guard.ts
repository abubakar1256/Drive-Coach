import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
@Injectable()
export class FinanceGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    if (!["ADMIN", "SUPER_ADMIN"].includes(req.user?.role)) throw new ForbiddenException("Administrator finance permission required");
    return true;
  }
}
