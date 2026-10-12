import { Module } from "@nestjs/common";
import { AiChatController } from "./ai-chat.controller";
import { AiChatService } from "./ai-chat.service";
import { AuthModule } from "../auth/auth.module";
import { RoutesModule } from "../routes/routes.module";

@Module({ imports: [AuthModule, RoutesModule], controllers: [AiChatController], providers: [AiChatService] })
export class AiChatModule {}
