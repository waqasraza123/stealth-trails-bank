import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class ApplyManualResolutionDto {
  @IsString()
  @IsNotEmpty()
  manualResolutionReasonCode!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
