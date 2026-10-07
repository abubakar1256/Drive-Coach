import { Body, Controller, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { AiChatDto } from "./dto/ai-chat.dto";
import { AiChatService } from "./ai-chat.service";

@Controller("ai")
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Post("chat")
  answer(@Body() dto: AiChatDto, @Req() request: Request) {
    return this.aiChatService.answer(dto, request.ip || "unknown");
  }
}
