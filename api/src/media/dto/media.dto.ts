import { IsIn, IsString, MaxLength, MinLength } from "class-validator";

export class UploadMediaDto {
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
