import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateSchoolDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MinLength(2) @MaxLength(80) slug!: string;
  @IsOptional() @IsEmail() email?: string;
}

export class InviteStudentDto {
  @IsEmail() studentEmail!: string;
}
