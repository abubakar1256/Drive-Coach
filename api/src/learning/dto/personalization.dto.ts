import { ArrayMaxSize, ArrayUnique, Equals, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, IsUrl, Length, Max, Min, Matches } from "class-validator";
import { PreparationVersionDto } from "./preparation.dto";
import { focusCodes } from "../personalization-policy";

export class HometownGenerationDto extends PreparationVersionDto {
  @IsString() @Matches(/^gn:\d{1,12}$/) placeId!: string;
  @IsUUID("4") requestKey!: string;
  @Equals(true) consent!: boolean;
  @Equals(true) parked!: boolean;
}
export class PrivateSessionDto {
  @IsString() @Length(1,100) ownerId!: string;
  @IsOptional() @IsUUID("4") sessionId?: string;
  @Equals(true) parked!: boolean;
}
export class HometownReflectionDto {
  @IsString() @Length(1,100) ownerId!: string;
  @IsArray() @ArrayUnique() @ArrayMaxSize(12) @IsIn([...focusCodes], { each: true }) difficultyCategories!: string[];
  @IsArray() @ArrayUnique() @ArrayMaxSize(12) @IsIn([...focusCodes], { each: true }) instructorCategories!: string[];
  @Equals(true) parked!: boolean;
}
export class CoverageReviewDto {
  @IsInt() @Min(1) @Max(2147483646) routeVersion!: number;
  @IsString() @Matches(/^[a-f0-9]{64}$/) fingerprint!: string;
  @IsArray() @ArrayUnique() @ArrayMaxSize(12) @IsIn([...focusCodes], { each: true }) skills!: string[];
  @IsIn(["LOW","MEDIUM","HIGH"]) complexity!: string;
  @IsUrl({ protocols: ["https"], require_protocol: true }) @Length(10,500) sourceUrl!: string;
  @IsString() @Length(20,2000) notes!: string;
  @Equals(true) confirmReviewed!: boolean;
}
