import { Module } from "@nestjs/common";
import { ConnectorsModule } from "../connectors/connectors.module";
import { FormsModule } from "../forms/forms.module";
import { SubmissionsController } from "./submissions.controller";
import { SubmissionsService } from "./submissions.service";
import { SubmissionActionRunnerService } from "./submission-action-runner.service";
import { EmailPdfService } from "./runtime/email-pdf.service";

@Module({
  imports: [ConnectorsModule, FormsModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService, SubmissionActionRunnerService, EmailPdfService],
})
export class SubmissionsModule {}
