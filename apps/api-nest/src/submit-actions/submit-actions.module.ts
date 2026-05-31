import { Module } from "@nestjs/common";
import { SubmitActionsController } from "./submit-actions.controller";
import { SubmitActionsService } from "./submit-actions.service";
import { ConnectorsModule } from "../connectors/connectors.module";

@Module({
  imports: [ConnectorsModule],
  controllers: [SubmitActionsController],
  providers: [SubmitActionsService],
})
export class SubmitActionsModule {}
