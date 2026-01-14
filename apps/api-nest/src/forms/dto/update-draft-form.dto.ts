import { IsObject, IsOptional, IsString } from "class-validator";

export class UpdateDraftFormDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsOptional()
  schemaJson?: Record<string, any>;
}