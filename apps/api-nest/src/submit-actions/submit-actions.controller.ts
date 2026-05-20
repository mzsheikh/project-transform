import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CreateSubmitActionDto, UpdateSubmitActionDto } from "./dto/submit-action.dto";
import { SubmitActionsService } from "./submit-actions.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("editor")
@Controller()
export class SubmitActionsController {
  constructor(private readonly actions: SubmitActionsService) {}

  @Get("apps/:appCode/forms/:formKey/submit-actions")
  list(@Param("appCode") appCode: string, @Param("formKey") formKey: string) {
    return this.actions.listDraft(appCode.toUpperCase(), formKey);
  }

  @Post("apps/:appCode/forms/:formKey/submit-actions")
  create(
    @Param("appCode") appCode: string,
    @Param("formKey") formKey: string,
    @Body() dto: CreateSubmitActionDto,
  ) {
    return this.actions.create(appCode.toUpperCase(), formKey, dto);
  }

  @Put("apps/:appCode/forms/:formKey/submit-actions/:actionId")
  update(
    @Param("appCode") appCode: string,
    @Param("formKey") formKey: string,
    @Param("actionId") actionId: string,
    @Body() dto: UpdateSubmitActionDto,
  ) {
    return this.actions.update(appCode.toUpperCase(), formKey, actionId, dto);
  }

  @Delete("apps/:appCode/forms/:formKey/submit-actions/:actionId")
  delete(
    @Param("appCode") appCode: string,
    @Param("formKey") formKey: string,
    @Param("actionId") actionId: string,
  ) {
    return this.actions.delete(appCode.toUpperCase(), formKey, actionId);
  }
}
