import { IsDateString, IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateSchoolDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MinLength(2) @MaxLength(80) slug!: string;
  @IsOptional() @IsEmail() email?: string;
}

export class InviteStudentDto {
  @IsEmail() studentEmail!: string;
}

export class AssignRouteDto {
  @IsString() @MinLength(2) routeId!: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @IsDateString() dueAt?: string;
}
export class InstructorFeedbackDto {
  @IsString() @MinLength(2) sessionId!: string;
  @IsString() @MinLength(2) @MaxLength(2000) body!: string;
}
export class InviteInstructorDto { @IsEmail() email!: string; }
