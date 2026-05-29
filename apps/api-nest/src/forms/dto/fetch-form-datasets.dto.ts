import { IsInt, IsObject, IsOptional } from "class-validator";

export class FetchFormDatasetsDto {
  @IsInt()
  formVersion!: number;

  @IsObject()
  @IsOptional()
  data?: Record<string, unknown>;
}

export class PreviewFormDataSourceDto {
  @IsObject()
  source!: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  data?: Record<string, unknown>;
}
