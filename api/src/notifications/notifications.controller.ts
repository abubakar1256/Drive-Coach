import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AuthenticatedRequest, JwtAuthGuard } from "../auth/auth.guard";
import { NotificationsService } from "./notifications.service";
import { ReminderPreferencesDto } from "./notification.dto";

@Controller("me/notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get("preferences") preferences(@Req() req: AuthenticatedRequest) { return this.notificationsService.preferences(req.user.sub); }
  @Post("preferences") savePreferences(@Req() req: AuthenticatedRequest, @Body() dto: ReminderPreferencesDto) { return this.notificationsService.savePreferences(req.user.sub, dto); }

  @Get()
  list(@Req() request: AuthenticatedRequest) { return this.notificationsService.list(request.user.sub); }

  @Get("unread-count")
  unreadCount(@Req() request: AuthenticatedRequest) { return this.notificationsService.unreadCount(request.user.sub); }

  @Post(":id/read")
  markRead(@Req() request: AuthenticatedRequest, @Param("id") id: string) { return this.notificationsService.markRead(request.user.sub, id); }
}
