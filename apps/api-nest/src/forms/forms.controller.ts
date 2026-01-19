import { Body, Controller, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { FormsService } from "./forms.service";
import { CreateDraftFormDto } from "./dto/create-draft-form.dto";
import { UpdateDraftFormDto } from "./dto/update-draft-form.dto";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@Controller()
export class FormsController {
  constructor(private readonly forms: FormsService) {}

  @Get("apps/:appCode/forms")
  list(@Param("appCode") appCode: string) {
    return this.forms.list(appCode.toUpperCase());
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("editor")
  @Post("apps/:appCode/forms")
  createDraft(@Param("appCode") appCode: string, @Body() dto: CreateDraftFormDto) {
    return this.forms.createDraft(appCode.toUpperCase(), dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("editor")
  @Put("apps/:appCode/forms/:formKey/draft")
  updateDraft(
    @Param("appCode") appCode: string,
    @Param("formKey") formKey: string,
    @Body() dto: UpdateDraftFormDto,
  ) {
    return this.forms.updateDraft(appCode.toUpperCase(), formKey, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("editor")
  @Post("apps/:appCode/forms/:formKey/publish")
  publish(@Param("appCode") appCode: string, @Param("formKey") formKey: string) {
    return this.forms.publish(appCode.toUpperCase(), formKey);
  }

  @Get("apps/:appCode/forms/:formKey/latest")
  latest(@Param("appCode") appCode: string, @Param("formKey") formKey: string) {
    return this.forms.latestPublished(appCode.toUpperCase(), formKey);
  }
}