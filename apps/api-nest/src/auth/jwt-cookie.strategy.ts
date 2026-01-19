import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, ExtractJwt } from "passport-jwt";

const ACCESS_COOKIE = "admin_access";

function cookieExtractor(req: any) {
  return req?.cookies?.[ACCESS_COOKIE] ?? null;
}

@Injectable()
export class JwtCookieStrategy extends PassportStrategy(Strategy, "jwt-cookie") {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      secretOrKey: process.env.JWT_ACCESS_SECRET!,
    });
  }

  validate(payload: any) {
    // This becomes req.user
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}