import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { AppsModule } from "./apps/apps.module";
import { FormsModule } from "./forms/forms.module";

@Module({
  imports: [PrismaModule, AppsModule, FormsModule],
})
export class AppModule {}