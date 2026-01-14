import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { AppsService } from "./apps.service";
import { CreateAppDto } from "./dto/create-app.dto";

@Controller()
export class AppsController {
  constructor(private readonly apps: AppsService) {}

  @Post("apps")
  createApp(@Body() dto: CreateAppDto) {
    return this.apps.create(dto);
  }

  @Get("apps/:appCode")
  getApp(@Param("appCode") appCode: string) {
    return this.apps.get(appCode.toUpperCase());
  }

  @Get("apps/:appCode/bootstrap")
  bootstrap(@Param("appCode") appCode: string) {
    return this.apps.bootstrap(appCode.toUpperCase());
  }

  @Get("apps")
  listApps() {
    return this.apps.list();
  }
}