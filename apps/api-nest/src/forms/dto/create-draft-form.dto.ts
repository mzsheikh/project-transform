import { IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator";

export class CreateDraftFormDto {
  @IsString()
  @IsNotEmpty()
  formKey!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  // Stores your entire FormDefinition JSON
  @IsObject()
  schemaJson!: Record<string, any>;
}