import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsIn, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";

export class AiChatMessageDto {
  @IsIn(["user", "assistant"])
  role!: "user" | "assistant";

  @IsString()
  @MaxLength(4000)
  content!: string;
}

export class AiChatDto {
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AiChatMessageDto)
  messages!: AiChatMessageDto[];

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}
