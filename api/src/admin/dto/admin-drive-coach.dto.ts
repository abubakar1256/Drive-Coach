import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class ReviewTipDto {
  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @IsOptional()
  @IsBoolean()
  adminApproved?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  sourceReference?: string;
}
