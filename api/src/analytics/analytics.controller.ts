import { Body, Controller, Post } from "@nestjs/common";
import { RecordAnalyticsEventDto } from "./dto/analytics.dto";
import { AnalyticsService } from "./analytics.service";

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post("events")
  record(@Body() dto: RecordAnalyticsEventDto) {
    return this.analytics.record(dto);
  }
}
