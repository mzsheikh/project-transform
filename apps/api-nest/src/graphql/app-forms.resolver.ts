import { Args, Query, Resolver } from "@nestjs/graphql";
import { AppsService } from "../apps/apps.service";
import { FormsService } from "../forms/forms.service";
import { AppWithForms } from "./types";

@Resolver()
export class AppFormsResolver {
  constructor(
    private readonly apps: AppsService,
    private readonly forms: FormsService
  ) {}

  @Query(() => AppWithForms)
  async appWithForms(@Args("appCode") appCode: string): Promise<AppWithForms> {
    const app = await this.apps.get(appCode);
    const forms = await this.forms.list(appCode);
    return { app, forms };
  }
}
