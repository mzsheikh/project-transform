import { IsBoolean, IsIn, IsObject, IsOptional, IsString } from "class-validator";

export class CreateConnectorDto {
  @IsString()
  name!: string;

  @IsIn(["database", "rest_api"])
  type!: "database" | "rest_api";

  @IsIn(["postgresql", "mysql", "sqlserver"])
  @IsOptional()
  provider?: "postgresql" | "mysql" | "sqlserver";

  @IsObject()
  @IsOptional()
  configJson?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  secretsJson?: Record<string, unknown>;
}

export class UpdateConnectorDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsIn(["database", "rest_api"])
  @IsOptional()
  type?: "database" | "rest_api";

  @IsIn(["postgresql", "mysql", "sqlserver"])
  @IsOptional()
  provider?: "postgresql" | "mysql" | "sqlserver" | null;

  @IsObject()
  @IsOptional()
  configJson?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  secretsJson?: Record<string, unknown>;
}

export class DatabaseDdlDto {
  @IsObject()
  config!: Record<string, unknown>;

  @IsBoolean()
  @IsOptional()
  apply?: boolean;
}
