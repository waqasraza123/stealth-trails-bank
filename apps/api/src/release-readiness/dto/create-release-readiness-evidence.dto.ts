import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength
} from "class-validator";

export const releaseReadinessEvidenceTypes = [
  "platform_alert_delivery_slo",
  "critical_alert_reescalation",
  "database_restore_drill",
  "api_rollback_drill",
  "worker_rollback_drill"
] as const;

export const releaseReadinessEnvironments = [
  "staging",
  "production_like",
  "production"
] as const;

export const releaseReadinessEvidenceStatuses = [
  "pending",
  "passed",
  "failed"
] as const;

export type ReleaseReadinessEvidenceType =
  (typeof releaseReadinessEvidenceTypes)[number];

export type ReleaseReadinessEnvironment =
  (typeof releaseReadinessEnvironments)[number];

export type ReleaseReadinessEvidenceStatus =
  (typeof releaseReadinessEvidenceStatuses)[number];

export class CreateReleaseReadinessEvidenceDto {
  @IsIn(releaseReadinessEvidenceTypes)
  evidenceType!: ReleaseReadinessEvidenceType;

  @IsIn(releaseReadinessEnvironments)
  environment!: ReleaseReadinessEnvironment;

  @IsIn(releaseReadinessEvidenceStatuses)
  status!: ReleaseReadinessEvidenceStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  releaseIdentifier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  rollbackReleaseIdentifier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  backupReference?: string;

  @IsString()
  @MaxLength(1000)
  summary!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  runbookPath?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  evidenceLinks?: string[];

  @IsOptional()
  @IsObject()
  evidencePayload?: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @IsOptional()
  @IsDateString()
  observedAt?: string;
}
