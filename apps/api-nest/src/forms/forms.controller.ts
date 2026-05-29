import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { FormsService } from "./forms.service";
import { FormDatasetsService } from "./form-datasets.service";
import { CreateDraftFormDto } from "./dto/create-draft-form.dto";
import { UpdateDraftFormDto } from "./dto/update-draft-form.dto";
import { FetchFormDatasetsDto, PreviewFormDataSourceDto } from "./dto/fetch-form-datasets.dto";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { AiServiceGuard } from "../auth/ai-service.guard";

@Controller()
export class FormsController {
  constructor(
    private readonly forms: FormsService,
    private readonly datasets: FormDatasetsService,
  ) {}

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

    // ----------------------------
  // INTERNAL (FastAPI-only)
  // ----------------------------

  @UseGuards(AiServiceGuard)
  @Post("internal/apps/:appCode/forms")
  createDraftInternal(@Param("appCode") appCode: string, @Body() dto: CreateDraftFormDto) {
    // createdById optional; keep null for AI
    return this.forms.createDraft(appCode.toUpperCase(), dto, undefined);
  }

  @UseGuards(AiServiceGuard)
  @Put("internal/apps/:appCode/forms/:formKey/draft")
  updateDraftInternal(
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

  @Post("apps/:appCode/forms/:formKey/datasets")
  fetchDatasets(
    @Param("appCode") appCode: string,
    @Param("formKey") formKey: string,
    @Body() dto: FetchFormDatasetsDto,
  ) {
    return this.datasets.fetchPublished(appCode.toUpperCase(), formKey, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("editor")
  @Post("apps/:appCode/forms/:formKey/datasets/preview")
  previewDataSource(
    @Param("appCode") appCode: string,
    @Body() dto: PreviewFormDataSourceDto,
  ) {
    return this.datasets.previewSource(appCode.toUpperCase(), dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("editor")
  @Delete("apps/:appCode/forms/:formKey")
  deleteForm(@Param("appCode") appCode: string, @Param("formKey") formKey: string) {
    return this.forms.deleteForm(appCode.toUpperCase(), formKey);
  }
}
