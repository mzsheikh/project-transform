import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request, Response } from "express";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import {
  ACCESS_COOKIE_MAX_AGE_MS,
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_COOKIE_MAX_AGE_MS,
  REFRESH_TOKEN_EXPIRES_IN,
} from "./auth.constants";

const ACCESS_COOKIE = "admin_access";
const REFRESH_COOKIE = "admin_refresh";

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  private cookieOptions() {
    const isProd = process.env.NODE_ENV === "production";
    return {
      httpOnly: true,
      secure: isProd, // true in prod
      sameSite: isProd ? ("none" as const) : ("lax" as const),
      path: "/",
    };
  }

  private async signAccess(admin: { id: string; email: string; role: string }) {
    return this.jwt.signAsync(
      { sub: admin.id, email: admin.email, role: admin.role },
      { secret: process.env.JWT_ACCESS_SECRET!, expiresIn: ACCESS_TOKEN_EXPIRES_IN }
    );
  }

  private async signRefresh(admin: { id: string }) {
    return this.jwt.signAsync(
      { sub: admin.id, typ: "refresh" },
      { secret: process.env.JWT_REFRESH_SECRET!, expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    );
  }

  async login(email: string, password: string, res: Response) {
    const admin = await this.prisma.adminUser.findUnique({ where: { email } });

    if (!admin || !admin.isActive) throw new UnauthorizedException("Invalid credentials");
    if (!admin.passwordHash) throw new UnauthorizedException("Password login not enabled");

    const ok = await argon2.verify(admin.passwordHash, password);
    if (!ok) throw new UnauthorizedException("Invalid credentials");

    const accessToken = await this.signAccess({ id: admin.id, email: admin.email, role: admin.role });
    const refreshToken = await this.signRefresh({ id: admin.id });

    const refreshTokenHash = await argon2.hash(refreshToken);
    const refreshTokenExp = new Date(Date.now() + REFRESH_COOKIE_MAX_AGE_MS);

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { refreshTokenHash, refreshTokenExp },
    });

    res.cookie(ACCESS_COOKIE, accessToken, { ...this.cookieOptions(), maxAge: ACCESS_COOKIE_MAX_AGE_MS });
    res.cookie(REFRESH_COOKIE, refreshToken, { ...this.cookieOptions(), maxAge: REFRESH_COOKIE_MAX_AGE_MS });

    return { ok: true };
  }

  async refresh(req: Request, res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException("Missing refresh token");

    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(token, { secret: process.env.JWT_REFRESH_SECRET! });
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const adminId = payload.sub as string;
    const admin = await this.prisma.adminUser.findUnique({ where: { id: adminId } });
    if (!admin || !admin.isActive) throw new UnauthorizedException("Invalid refresh token");
    if (!admin.refreshTokenHash || !admin.refreshTokenExp) throw new UnauthorizedException("Invalid refresh token");
    if (admin.refreshTokenExp.getTime() < Date.now()) throw new UnauthorizedException("Refresh expired");

    const ok = await argon2.verify(admin.refreshTokenHash, token);
    if (!ok) throw new ForbiddenException("Refresh token mismatch");

    // rotate refresh token
    const newAccess = await this.signAccess({ id: admin.id, email: admin.email, role: admin.role });
    const newRefresh = await this.signRefresh({ id: admin.id });

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        refreshTokenHash: await argon2.hash(newRefresh),
        refreshTokenExp: new Date(Date.now() + REFRESH_COOKIE_MAX_AGE_MS),
      },
    });

    res.cookie(ACCESS_COOKIE, newAccess, { ...this.cookieOptions(), maxAge: ACCESS_COOKIE_MAX_AGE_MS });
    res.cookie(REFRESH_COOKIE, newRefresh, { ...this.cookieOptions(), maxAge: REFRESH_COOKIE_MAX_AGE_MS });

    return { ok: true };
  }

  async logout(res: Response) {
    res.clearCookie(ACCESS_COOKIE, { path: "/" });
    res.clearCookie(REFRESH_COOKIE, { path: "/" });
    return { ok: true };
  }
}
