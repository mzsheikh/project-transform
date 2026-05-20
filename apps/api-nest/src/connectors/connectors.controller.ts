import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { ConnectorsService } from "./connectors.service";
import { CreateConnectorDto, DatabaseDdlDto, UpdateConnectorDto } from "./dto/connector.dto";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("editor")
@Controller()
export class ConnectorsController {
  constructor(private readonly connectors: ConnectorsService) {}

  @Get("apps/:appCode/connectors")
  list(@Param("appCode") appCode: string) {
    return this.connectors.list(appCode.toUpperCase());
  }

  @Post("apps/:appCode/connectors")
  create(@Param("appCode") appCode: string, @Body() dto: CreateConnectorDto) {
    return this.connectors.create(appCode.toUpperCase(), dto);
  }

  @Get("apps/:appCode/connectors/:id")
  get(@Param("appCode") appCode: string, @Param("id") id: string) {
    return this.connectors.get(appCode.toUpperCase(), id);
  }

  @Put("apps/:appCode/connectors/:id")
  update(
    @Param("appCode") appCode: string,
    @Param("id") id: string,
    @Body() dto: UpdateConnectorDto,
  ) {
    return this.connectors.update(appCode.toUpperCase(), id, dto);
  }

  @Delete("apps/:appCode/connectors/:id")
  delete(@Param("appCode") appCode: string, @Param("id") id: string) {
    return this.connectors.delete(appCode.toUpperCase(), id);
  }

  @Post("apps/:appCode/connectors/:id/test")
  test(@Param("appCode") appCode: string, @Param("id") id: string) {
    return this.connectors.test(appCode.toUpperCase(), id);
  }

  @Get("apps/:appCode/connectors/:id/schema")
  inspectSchema(@Param("appCode") appCode: string, @Param("id") id: string) {
    return this.connectors.inspectSchema(appCode.toUpperCase(), id);
  }

  @Post("apps/:appCode/connectors/:id/ddl/preview")
  previewDdl(
    @Param("appCode") appCode: string,
    @Param("id") id: string,
    @Body() dto: DatabaseDdlDto,
  ) {
    return this.connectors.previewDdl(appCode.toUpperCase(), id, dto);
  }

  @Post("apps/:appCode/connectors/:id/ddl/apply")
  applyDdl(
    @Param("appCode") appCode: string,
    @Param("id") id: string,
    @Body() dto: DatabaseDdlDto,
  ) {
    return this.connectors.applyDdl(appCode.toUpperCase(), id, dto);
  }
}
