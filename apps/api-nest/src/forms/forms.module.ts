import { Module } from "@nestjs/common";
import { FormsController } from "./forms.controller";
import { FormsService } from "./forms.service";
import { AiServiceGuard } from "../auth/ai-service.guard";

@Module({
  controllers: [FormsController],
  providers: [FormsService, AiServiceGuard],
  exports: [FormsService],
})
export class FormsModule {}
