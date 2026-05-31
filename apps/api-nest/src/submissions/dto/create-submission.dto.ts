import { IsInt, IsObject, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateSubmissionDto {
  @IsUUID()
  submissionId!: string;

  @IsInt()
  formVersion!: number;

  @IsObject()
  data!: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  variables?: {
    form?: Record<string, unknown>;
    global?: Record<string, unknown>;
  };

  @IsString()
  @IsOptional()
  triggerKey?: string;

  @IsString()
  @IsOptional()
  createdAt?: string;

  @IsString()
  @IsOptional()
  updatedAt?: string;
}
