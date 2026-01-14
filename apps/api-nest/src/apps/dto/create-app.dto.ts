import { IsNotEmpty, IsString } from "class-validator";

export class CreateAppDto {
  @IsString()
  @IsNotEmpty()
  appCode!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;
}