import { IsIn, IsObject, IsOptional, IsString, MaxLength } from "class-validator";

export class RecordAnalyticsEventDto {
  @IsIn(["PAGE_VIEW", "CENTRE_VIEW", "ROUTE_VIEW"])
  eventType!: "PAGE_VIEW" | "CENTRE_VIEW" | "ROUTE_VIEW";

  @IsOptional()
  @IsString()
  @MaxLength(160)
  centreSlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  routeSlug?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, string | number | boolean>;
}
