import { IsBoolean, IsObject, IsOptional, IsString } from "class-validator";

export class GenerateFormDatabaseMappingDto {
  @IsString()
  formKey!: string;
}

export class SaveFormDatabaseMappingDto {
  @IsString()
  formKey!: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsObject()
  mappingJson!: Record<string, unknown>;

  @IsBoolean()
  @IsOptional()
  allowDestructiveSync?: boolean;
}
