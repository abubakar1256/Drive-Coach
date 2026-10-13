import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
export class ReminderPreferencesDto {
  @IsBoolean() remindersEnabled!: boolean;
  @IsOptional() @IsDateString() examDate?: string | null;
  @IsOptional() @IsDateString() practiceReminderAt?: string | null;
}
export class AnnouncementDto {
  @IsString() @MinLength(2) @MaxLength(120) title!: string;
  @IsString() @MinLength(2) @MaxLength(1000) body!: string;
}
