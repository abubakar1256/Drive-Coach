import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CheckoutDto {
  @IsString()
  @MinLength(10)
  planId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  couponCode?: string;
}

export class CouponValidationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  code!: string;

  @IsString()
  @MinLength(10)
  planId!: string;
}

export class CreateCouponDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  code!: string;

  @IsOptional()
  percentOff?: number;

  @IsOptional()
  amountOffCents?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  maxRedemptions?: number;

  @IsOptional()
  @IsString()
  expiresAt?: string;
}
