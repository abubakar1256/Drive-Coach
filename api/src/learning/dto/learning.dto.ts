import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class CreatePracticeSessionDto {
  @IsString()
  routeId!: string;
}

export class UpdatePracticeSessionDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  completionPct?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationSec?: number;

  @IsOptional()
  @IsBoolean()
  complete?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CreateReflectionDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  speedCompliance?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rightOfWayConfidence?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  roundaboutConfidence?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  laneChangeConfidence?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(300)
  observedSpeedKph?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  speedLimitKph?: number;

  @IsOptional()
  @IsBoolean()
  flaggedSpeeding?: boolean;

  @IsOptional()
  @IsBoolean()
  missedRightOfWay?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
