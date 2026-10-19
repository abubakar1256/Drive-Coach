import { Transform } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, Min, ValidateIf } from "class-validator";
import { preparationLevels, type PreparationLevel } from "../preparation-policy";
const trim = ({ value }: { value: unknown }) => typeof value === "string" ? value.trim() : value;
export class PreparationVersionDto {
  @IsString() @Length(1, 100) ownerId!: string;
  @IsInt() @Min(0) @Max(2147483646) version!: number;
  @IsOptional() @IsUUID("4") revision?: string | null;
}
export class UpdatePreparationDto extends PreparationVersionDto {
  @IsOptional() @Transform(trim) @IsString() @Length(1, 80) preferredName?: string | null;
  @IsOptional() @IsInt() @Min(1) @Max(120) age?: number | null;
  @IsOptional() @IsString() @Length(1, 100) centreId?: string | null;
  @IsOptional() @Transform(trim) @IsString() @Length(2, 80)
  @Matches(/^[\p{L}\p{M} .()'’-]+$/u, { message: "Use a town/area name, not a street address, postcode or coordinates" })
  homeTown?: string | null;
  @ValidateIf((_, value) => value !== undefined) @IsIn([...preparationLevels]) preferredLevel?: PreparationLevel;
}
