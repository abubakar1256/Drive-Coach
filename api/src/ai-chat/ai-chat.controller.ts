import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { AuthenticatedRequest, JwtAuthGuard } from "../auth/auth.guard";
import { AiChatDto } from "./dto/ai-chat.dto";
import { AiChatService } from "./ai-chat.service";

@Controller("ai")
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Post("chat")
  @UseGuards(JwtAuthGuard)
  answer(@Body() dto: AiChatDto, @Req() request: AuthenticatedRequest) {
    return this.aiChatService.answer(dto, request.ip || "unknown", request.user.sub);
  }
}
