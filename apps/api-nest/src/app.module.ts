import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { AppsModule } from "./apps/apps.module";
import { FormsModule } from "./forms/forms.module";
import { AuthModule } from "./auth/auth.module";
import { AppGraphqlModule } from "./graphql/graphql.module";
import { ConnectorsModule } from "./connectors/connectors.module";
import { SubmitActionsModule } from "./submit-actions/submit-actions.module";
import { SubmissionsModule } from "./submissions/submissions.module";

@Module({
  imports: [
    PrismaModule,
    AppsModule,
    FormsModule,
    AuthModule,
    AppGraphqlModule,
    ConnectorsModule,
    SubmitActionsModule,
    SubmissionsModule,
  ],
})
export class AppModule {}
