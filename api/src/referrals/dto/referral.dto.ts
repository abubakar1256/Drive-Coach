import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class CreateReferralCodeDto {
  @IsString() @MinLength(3) @MaxLength(40) code!: string;
  @IsOptional() @IsString() @MaxLength(80) schoolId?: string;
  @IsOptional() @IsInt() @Min(0) @Max(3000) commissionBps?: number;
}

export class ClaimReferralDto {
  @IsString() @MinLength(3) @MaxLength(40) code!: string;
}
