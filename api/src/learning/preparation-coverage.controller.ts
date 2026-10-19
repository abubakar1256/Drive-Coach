import { Body, ConflictException, Controller, ForbiddenException, Get, Header, NotFoundException, Param, Patch, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/auth.guard";
import { AdminGuard } from "../admin/admin.guard";
import { PrismaService } from "../prisma.service";
import { CoverageReviewDto } from "./dto/personalization.dto";
import { coverageCurrent, coverageFingerprint } from "./personalization-policy";
import { publishedRoutePolicy } from "../routes/published-route-policy";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";

@Controller("admin/preparation-coverage")
@UseGuards(JwtAuthGuard,AdminGuard)
export class PreparationCoverageController {
  constructor(private readonly prisma:PrismaService) {}
  private async requireCurrentReviewer(userId:string) {
    const user=await this.prisma.user.findUnique({where:{id:userId},select:{role:true}});
    if(!user||!["ADMIN","SUPER_ADMIN","CONTENT_MANAGER"].includes(user.role))throw new ForbiddenException("Current content-review permission required");
  }
  @Get() @Header("Cache-Control","private, no-store")
  async list(@Req() r:AuthenticatedRequest) {
    await this.requireCurrentReviewer(r.user.sub);
    const routes=await this.prisma.route.findMany({where:{...publishedRoutePolicy,centre:{isPublished:true}},include:{points:{orderBy:{sequence:"asc"}},preparationCoverage:true,centre:{select:{name:true}}},orderBy:{id:"asc"},take:300});
    return routes.map(r=>({id:r.id,name:r.name,centre:r.centre.name,version:r.version,fingerprint:coverageFingerprint(r),current:coverageCurrent(r),review:r.preparationCoverage,href:`/routes/${r.slug}`}));
  }
  @Patch(":id") @Header("Cache-Control","private, no-store")
  async review(@Req() r:AuthenticatedRequest,@Param("id") id:string,@Body() data:CoverageReviewDto) {
    await this.requireCurrentReviewer(r.user.sub);
    const dto=plainToInstance(CoverageReviewDto,data);
    if(validateSync(dto,{whitelist:true,forbidNonWhitelisted:true}).length)throw new ConflictException("Explicit source-backed coverage review required");
    return this.prisma.$transaction(async tx=>{
      await tx.$queryRawUnsafe('SELECT "id" FROM "Route" WHERE "id"=$1 FOR UPDATE',id);
      const route=await tx.route.findFirst({where:{id,...publishedRoutePolicy,centre:{isPublished:true}},include:{points:{orderBy:{sequence:"asc"}}}});
      if(!route)throw new NotFoundException("Reviewed published route required");
      if(route.version!==dto.routeVersion||coverageFingerprint(route)!==dto.fingerprint)throw new ConflictException("Route changed. Reload and review the current version.");
      const review={routeVersion:route.version,fingerprint:dto.fingerprint,skills:dto.skills,complexity:dto.complexity,sourceUrl:dto.sourceUrl,notes:dto.notes,reviewedBy:r.user.sub,reviewedAt:new Date()};
      await tx.preparationCoverage.upsert({where:{routeId:id},create:{routeId:id,...review},update:review});
      await tx.auditLog.create({data:{userId:r.user.sub,action:"PREPARATION_COVERAGE_REVIEWED",entity:"Route",entityId:id,metadata:{routeVersion:route.version,skills:dto.skills}}});return {saved:true};
    });
  }
}
