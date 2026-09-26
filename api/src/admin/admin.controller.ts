import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AuthenticatedRequest, JwtAuthGuard } from "../auth/auth.guard";
import { AdminGuard } from "./admin.guard";
import { AdminService } from "./admin.service";
import { CreateRouteDto, CreateRoutePointDto, ReorderPointsDto, UpdateRouteDto, UpdateRoutePointDto } from "./dto/admin-route.dto";
import { CreateCentreDto } from "./dto/admin-centre.dto";
import { UpdateUserRoleDto } from "./dto/admin-user.dto";
import { ReviewTipDto } from "./dto/admin-drive-coach.dto";

@Controller("admin")
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("centres")
  listCentres() {
    return this.adminService.listCentres();
  }

  @Post("centres")
  createCentre(@Body() dto: CreateCentreDto) {
    return this.adminService.createCentre(dto);
  }

  @Get("routes")
  listRoutes() {
    return this.adminService.listRoutes();
  }

  @Get("reports/overview")
  overview() {
    return this.adminService.overview();
  }

  @Get("audit-logs")
  auditLogs() {
    return this.adminService.auditLogs();
  }

  @Get("payments")
  payments() {
    return this.adminService.payments();
  }

  @Get("users")
  users() {
    return this.adminService.users();
  }

  @Patch("users/:id/role")
  updateUserRole(@Param("id") id: string, @Body() dto: UpdateUserRoleDto, @Req() request: AuthenticatedRequest) {
    return this.adminService.updateUserRole(request.user.sub, request.user.role, id, dto);
  }

  @Get("commissions")
  commissions() {
    return this.adminService.commissions();
  }

  @Get("drive-coach/tips")
  driveCoachTips() {
    return this.adminService.driveCoachTips();
  }

  @Patch("drive-coach/tips/:id")
  reviewDriveCoachTip(@Param("id") id: string, @Body() dto: ReviewTipDto, @Req() request: AuthenticatedRequest) {
    return this.adminService.reviewDriveCoachTip(request.user.sub, id, dto);
  }

  @Post("routes")
  createRoute(@Body() dto: CreateRouteDto) {
    return this.adminService.createRoute(dto);
  }

  @Patch("routes/:id")
  updateRoute(@Param("id") id: string, @Body() dto: UpdateRouteDto) {
    return this.adminService.updateRoute(id, dto);
  }

  @Delete("routes/:id")
  archiveRoute(@Param("id") id: string) {
    return this.adminService.archiveRoute(id);
  }

  @Post("routes/:id/points")
  createPoint(@Param("id") routeId: string, @Body() dto: CreateRoutePointDto) {
    return this.adminService.createPoint(routeId, dto);
  }

  @Patch("routes/:id/points/reorder")
  reorderPoints(@Param("id") routeId: string, @Body() dto: ReorderPointsDto) {
    return this.adminService.reorderPoints(routeId, dto);
  }

  @Patch("points/:id")
  updatePoint(@Param("id") id: string, @Body() dto: UpdateRoutePointDto) {
    return this.adminService.updatePoint(id, dto);
  }

  @Delete("points/:id")
  deletePoint(@Param("id") id: string) {
    return this.adminService.deletePoint(id);
  }
}
