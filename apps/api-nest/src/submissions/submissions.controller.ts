import { Body, Controller, Param, Post } from "@nestjs/common";
import { CreateSubmissionDto } from "./dto/create-submission.dto";
import { SubmissionsService } from "./submissions.service";

@Controller()
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  @Post("apps/:appCode/forms/:formKey/submissions")
  submit(
    @Param("appCode") appCode: string,
    @Param("formKey") formKey: string,
    @Body() dto: CreateSubmissionDto,
  ) {
    return this.submissions.submit(appCode.toUpperCase(), formKey, dto);
  }
}
