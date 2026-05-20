import { IsInt, IsObject, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateSubmissionDto {
  @IsUUID()
  submissionId!: string;

  @IsInt()
  formVersion!: number;

  @IsObject()
  data!: Record<string, unknown>;

  @IsString()
  @IsOptional()
  createdAt?: string;

  @IsString()
  @IsOptional()
  updatedAt?: string;
}
