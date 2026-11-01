import { Equals, IsBoolean, IsIn, IsOptional, IsString, IsUrl, MaxLength, MinLength } from "class-validator";
import { Transform } from "class-transformer";

export class MediaRightsDto {
  @IsIn(["OWNED", "LICENSED"]) rightsType!: "OWNED" | "LICENSED";
  @IsString() @MinLength(1) @MaxLength(180) rightsHolder!: string;
  @IsString() @MinLength(1) @MaxLength(180) licenseName!: string;
  @IsOptional() @IsUrl({ protocols: ["https"], require_protocol: true }) @MaxLength(1000) sourceUrl?: string;
  @Transform(({ value }) => value === true || value === "true") @IsBoolean() @Equals(true) permissionConfirmed!: boolean;
}
export class UploadMediaFileDto extends MediaRightsDto {
  @IsString() @MinLength(1) @MaxLength(80) routePointId!: string;
}
export class UploadMediaDto extends MediaRightsDto {
  @IsString()
  @MinLength(10)
  @MaxLength(20_000_000)
  dataBase64!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(180)
  originalName!: string;

  @IsString()
  @IsIn(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"])
  mimeType!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  routePointId!: string;
}
