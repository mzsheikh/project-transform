import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "./roles.decorator";

const rank: Record<string, number> = { viewer: 1, editor: 2, admin: 3 };

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;

    const req: any = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user?.role) return false;

    const userRank = rank[user.role] ?? 0;
    const requiredRank = Math.max(...roles.map((r) => rank[r] ?? 0));
    return userRank >= requiredRank;
  }
}