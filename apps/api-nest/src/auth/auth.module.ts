import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtCookieStrategy } from "./jwt-cookie.strategy";
import { PrismaService } from "../prisma/prisma.service";
import { ACCESS_TOKEN_EXPIRES_IN } from "./auth.constants";

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET!,
      signOptions: { expiresIn: ACCESS_TOKEN_EXPIRES_IN },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtCookieStrategy, PrismaService],
  exports: [AuthService],
})
export class AuthModule {}
