import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAppDto } from "./dto/create-app.dto";

@Injectable()
export class AppsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateAppDto) {
    const appCode = dto.appCode.trim().toUpperCase();

    try {
      return await this.prisma.app.create({
        data: { appCode, name: dto.name.trim(), settings: {} },
      });
    } catch (e: any) {
      // Unique constraint
      throw new BadRequestException("appCode already exists");
    }
  }

  async get(appCode: string) {
    const app = await this.prisma.app.findUnique({ where: { appCode } });
    if (!app) throw new NotFoundException("App not found");
    return app;
  }

  async list() {
  return this.prisma.app.findMany({ orderBy: { createdAt: "desc" } });
}

  /**
   * Mobile bootstrap: app settings + list of published forms
   */
  async bootstrap(appCode: string) {
    const app = await this.prisma.app.findUnique({ where: { appCode } });
    if (!app) throw new NotFoundException("App not found");

    const forms = await this.prisma.form.findMany({
      where: { appCode, status: "published" },
      select: { formKey: true, title: true, version: true, description: true },
      orderBy: [{ formKey: "asc" }, { version: "desc" }],
    });

    // If multiple published versions exist, keep only latest per formKey
    const latestByKey = new Map<string, (typeof forms)[number]>();
    for (const f of forms) {
      if (!latestByKey.has(f.formKey)) latestByKey.set(f.formKey, f);
    }

    return {
      app: { appCode: app.appCode, name: app.name, settings: app.settings },
      forms: Array.from(latestByKey.values()),
    };
  }
}