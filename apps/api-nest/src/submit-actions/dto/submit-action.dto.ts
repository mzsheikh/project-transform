import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString } from "class-validator";

export class CreateSubmitActionDto {
  @IsIn(["email_pdf", "database", "rest_api"])
  type!: "email_pdf" | "database" | "rest_api";

  @IsString()
  name!: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsInt()
  @IsOptional()
  sortOrder?: number;

  @IsString()
  @IsOptional()
  triggerKey?: string | null;

  @IsString()
  @IsOptional()
  buttonActionId?: string | null;

  @IsString()
  @IsOptional()
  connectorId?: string | null;

  @IsObject()
  configJson!: Record<string, unknown>;
}

export class UpdateSubmitActionDto {
  @IsIn(["email_pdf", "database", "rest_api"])
  @IsOptional()
  type?: "email_pdf" | "database" | "rest_api";

  @IsString()
  @IsOptional()
  name?: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsInt()
  @IsOptional()
  sortOrder?: number;

  @IsString()
  @IsOptional()
  triggerKey?: string | null;

  @IsString()
  @IsOptional()
  buttonActionId?: string | null;

  @IsString()
  @IsOptional()
  connectorId?: string | null;

  @IsObject()
  @IsOptional()
  configJson?: Record<string, unknown>;
}
