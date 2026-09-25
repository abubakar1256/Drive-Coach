import { Controller, Get, NotFoundException, Param, Query, Req, UseGuards } from "@nestjs/common";
import { AuthenticatedRequest, JwtAuthGuard } from "../auth/auth.guard";
import { RoutesService } from "./routes.service";

@Controller("routes")
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get()
  list(@Query("centre") centreSlug?: string) {
    return this.routesService.list(centreSlug);
  }

  @Get(":slug/points")
  async points(@Param("slug") slug: string) {
    const points = await this.routesService.points(slug);
    if (!points) throw new NotFoundException("Route not found");
    return points;
  }

  @Get(":slug/access")
  @UseGuards(JwtAuthGuard)
  async accessible(@Param("slug") slug: string, @Req() request: AuthenticatedRequest) {
    const route = await this.routesService.getAccessibleBySlug(request.user.sub, slug);
    if (!route) throw new NotFoundException("Route not found");
    return route;
  }

  @Get(":slug/points/access")
  @UseGuards(JwtAuthGuard)
  async accessiblePoints(@Param("slug") slug: string, @Req() request: AuthenticatedRequest) {
    const points = await this.routesService.accessiblePoints(request.user.sub, slug);
    if (!points) throw new NotFoundException("Route not found");
    return points;
  }

  @Get(":slug")
  async getBySlug(@Param("slug") slug: string) {
    const route = await this.routesService.getBySlug(slug);
    if (!route) throw new NotFoundException("Route not found");
    return route;
  }
}
