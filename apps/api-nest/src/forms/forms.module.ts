import { Module } from "@nestjs/common";
import { FormsController } from "./forms.controller";
import { FormsService } from "./forms.service";
import { FormDatasetsService } from "./form-datasets.service";
import { AiServiceGuard } from "../auth/ai-service.guard";
import { ConnectorsModule } from "../connectors/connectors.module";

@Module({
  imports: [ConnectorsModule],
  controllers: [FormsController],
  providers: [FormsService, FormDatasetsService, AiServiceGuard],
  exports: [FormsService, FormDatasetsService],
})
export class FormsModule {}
