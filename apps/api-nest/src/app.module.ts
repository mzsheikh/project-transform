import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { AppsModule } from "./apps/apps.module";
import { FormsModule } from "./forms/forms.module";
import { AuthModule } from "./auth/auth.module";
import { AppGraphqlModule } from "./graphql/graphql.module";

@Module({
  imports: [PrismaModule, AppsModule, FormsModule, AuthModule, AppGraphqlModule],
})
export class AppModule {}
