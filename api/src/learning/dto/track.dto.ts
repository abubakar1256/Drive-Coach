import { IsDateString, IsLatitude, IsLongitude, IsNumber, IsOptional, Min } from "class-validator";

export class CreateTrackPointDto {
  @IsLatitude() latitude!: number;
  @IsLongitude() longitude!: number;
  @IsOptional() @IsNumber() @Min(0) speedKph?: number;
  @IsOptional() @IsNumber() @Min(0) accuracyM?: number;
  @IsOptional() @IsDateString() recordedAt?: string;
}
