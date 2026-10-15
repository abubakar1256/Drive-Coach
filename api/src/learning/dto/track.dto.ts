import { IsDateString, IsLatitude, IsLongitude, IsNumber, IsOptional, Max, Min } from "class-validator";

export class CreateTrackPointDto {
  @IsLatitude() latitude!: number;
  @IsLongitude() longitude!: number;
  @IsOptional() @IsNumber() @Min(0) @Max(300) speedKph?: number;
  @IsOptional() @IsNumber() @Min(0) accuracyM?: number;
  @IsOptional() @IsDateString() recordedAt?: string;
}
