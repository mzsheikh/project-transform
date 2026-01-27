import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";

@Injectable()
export class AiServiceGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();

    const token =
      (req.headers["x-ai-service-token"] as string | undefined) ??
      (req.headers["X-AI-Service-Token"] as string | undefined);

    const expected = process.env.AI_SERVICE_TOKEN;

    if (!expected) {
      throw new UnauthorizedException("AI_SERVICE_TOKEN not configured");
    }
    if (!token || token !== expected) {
      throw new UnauthorizedException("Invalid AI service token");
    }
    return true;
  }
}