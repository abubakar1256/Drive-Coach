import { RouteStatus } from "@prisma/client";
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsLatitude, IsLongitude, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class CreateRouteDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  centreId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  slug!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsEnum(RouteStatus)
  status?: RouteStatus;

  @IsOptional()
  @IsInt()
  @Min(23) @Max(27)
  durationMin?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  sourceLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  sourceUrl?: string;

  @IsOptional()
  @IsIn(["UNVERIFIED", "PENDING_REVIEW", "VERIFIED"])
  verificationStatus?: string;
}

export class UpdateRouteDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEnum(RouteStatus)
  status?: RouteStatus;

  @IsOptional()
  @IsInt()
  @Min(23) @Max(27)
  durationMin?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  sourceLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  sourceUrl?: string;

  @IsOptional()
  @IsIn(["UNVERIFIED", "PENDING_REVIEW", "VERIFIED"])
  verificationStatus?: string;
}

export class CreateRoutePointDto {
  @IsInt()
  @Min(1)
  sequence!: number;

  @IsString()
  @MinLength(2)
  @MaxLength(60)
  category!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  warning?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  videoUrl?: string;

  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;
}

export class UpdateRoutePointDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  sequence?: number;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  category?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  warning?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  videoUrl?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;
}

export class ReorderPointsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  pointIds!: string[];
}

export class UpdateOfficialPassagePointDto {
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsIn(["PENDING_REVIEW", "VERIFIED", "REJECTED"])
  verificationStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ImportRoutePointsDto {
  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(25)
  @ValidateNested({ each: true }) @Type(() => CreateRoutePointDto)
  points!: CreateRoutePointDto[];
}

export class GeneratePracticeLoopDto {
  @IsOptional() @IsInt() @Min(0) @Max(6) variant?: number;
  @IsOptional() @IsBoolean() publish?: boolean;
}

export class ImportRoadCatalogRouteDto {
  @IsInt() @Min(2) @Max(7) slot!: number;
}

export class ReviewDepartureDto {
  @IsLatitude() latitude!: number;
  @IsLongitude() longitude!: number;
  @IsString() @MinLength(3) @MaxLength(160) label!: string;
  @IsUrl({ protocols: ["https"], require_protocol: true }) @MaxLength(1000) sourceUrl!: string;
  @IsString() @MinLength(8) @MaxLength(1000) notes!: string;
  @IsIn(["PENDING_REVIEW", "VERIFIED", "REJECTED"]) verificationStatus!: string;
}
export class GeneratePassageRouteDto {
  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(6) @ArrayUnique() @IsString({ each: true })
  passagePointIds!: string[];
}
