import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException, HttpException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { PreparationService } from "./preparation.service";
import { RouteAccessService } from "../routes/route-access.service";
import { DrivingRouteService } from "../routes/driving-route.service";
import { loopCandidates, simpleRoadCycles, cycleWaypoints, removeSharedAccessStem } from "../routes/practice-loop.service";
import { publishedRoutePolicy } from "../routes/published-route-policy";
import { rankPreparation, checkedPrivateSnapshot, type PrivateSnapshot } from "./personalization-policy";
import { hometownPlace } from "./belgian-places";
import { HometownGenerationDto, HometownReflectionDto, PrivateSessionDto } from "./dto/personalization.dto";
import { type PreparationLevel } from "./preparation-policy";
import { trackProgress } from "./practice-progress";
import { CreateTrackPointDto } from "./dto/track.dto";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import type { Prisma } from "@prisma/client";

const MAX_REQUESTS = 8;
function input<T extends object>(type: new()=>T, data: T): T {
  const dto=plainToInstance(type,data);
  if(validateSync(dto,{whitelist:true,forbidNonWhitelisted:true}).length) throw new BadRequestException("Check the preparation request fields");
  return dto;
}
const asJson = (value: unknown) => value as Prisma.InputJsonValue;
const budgetValue = (key: string, maximum: number) => { const n=Number(process.env[key]); return Number.isSafeInteger(n)&&n>=MAX_REQUESTS&&n<=maximum?n:0; };

@Injectable()
export class PersonalizedPracticeService {
  constructor(private readonly prisma: PrismaService, private readonly preparation: PreparationService, private readonly access: RouteAccessService, private readonly driving: DrivingRouteService) {}

  async recommendations(userId: string, sourceCentreId?:string) {
    const profile=await this.preparation.get(userId);
    const centreId=sourceCentreId??profile.centreId;
    const routes=await this.prisma.route.findMany({where:{...publishedRoutePolicy,durationMin:{gte:23,lte:27},centre:{isPublished:true},...(centreId?{centreId}:{})},include:{centre:{select:{name:true,slug:true}},points:{orderBy:{sequence:"asc"}},preparationCoverage:true},orderBy:{id:"asc"},take:160});
    const ranked=rankPreparation(routes,profile.focus,profile.preferredLevel as PreparationLevel);
    const suggestions=[];
    for(const entry of ranked) {
      let unlocked=false;
      try { await this.access.requireAccess(userId,entry.route.id); unlocked=true; }
      catch(e) { if (!(e instanceof ForbiddenException || e instanceof NotFoundException)) throw e; }
      suggestions.push({id:entry.route.id,slug:entry.route.slug,name:entry.route.name,centreName:entry.route.centre.name,centreId:entry.route.centreId,durationMin:entry.route.durationMin,unlocked,score:unlocked?entry.score:0,matched:unlocked?entry.matched:[],levelMatched:unlocked&&entry.levelMatched,coverage:unlocked?entry.coverage:{status:"LOCKED"},reason:unlocked?entry.reason:"Current route access is required. A suggestion never starts or extends your trial.",href:`/routes/${entry.route.slug}`});
    }
    suggestions.sort((a,b)=>Number(b.unlocked)-Number(a.unlocked)||b.score-a.score||a.id.localeCompare(b.id));
    const history=await this.prisma.practiceSession.findMany({where:{userId},orderBy:{startedAt:"desc"},take:6,select:{id:true,completionKind:true,completedAt:true,route:{select:{name:true,slug:true}},routeSnapshot:true}});
    const past=history.map(s=>({id:s.id,name:s.route.name,slug:s.route.slug,status:s.completionKind,ended:Boolean(s.completedAt),version:(s.routeSnapshot as any)?.routeVersion??null,repeatAvailable:Boolean(s.completedAt&&(s.routeSnapshot as any)?.durationSec),reportHref:`/practice/${s.id}`}));
    const hometownAllowed=Boolean(profile.centreId&&(await this.access.centreAccess(userId,profile.centreId)).premium);
    return {ownerId:userId,selectedLevel:profile.preferredLevel,focus:profile.focus,centreId:profile.centreId,routes:suggestions.slice(0,6),history:past,hometown:{allowed:hometownAllowed,configured:budgetValue("HOMETOWN_DAILY_REQUEST_BUDGET",1000)>0&&budgetValue("HOMETOWN_MONTHLY_REQUEST_BUDGET",10000)>0,maxRequests:MAX_REQUESTS},safety:"Recommendations are preparation suggestions, not ability scores, guaranteed feature coverage or official examiner itineraries. Unknown coverage stays unknown."};
  }

  private async requirePaid(userId: string, centreId: string) {
    const centre=await this.prisma.examCentre.findFirst({where:{id:centreId,isPublished:true},select:{id:true}});
    if(!centre) throw new ForbiddenException("Source centre is unavailable");
    if(!(await this.access.centreAccess(userId,centreId)).premium) throw new ForbiddenException("Hometown practice requires active Basic access for the selected source centre or Premium. A Free trial does not grant hometown generation.");
  }
  private async profileBinding(userId: string, dto: HometownGenerationDto) {
    if(dto.ownerId!==userId)throw new ConflictException("Account changed. Reload preparation.");
    const p=await this.preparation.get(userId);
    if(!p.saved||p.version!==dto.version||p.revision!==dto.revision||!p.centreId)throw new ConflictException("Save/reload a profile with a source exam centre before generating.");
    await this.requirePaid(userId,p.centreId);return p;
  }
  async generate(userId: string, data: HometownGenerationDto) {
    const dto=input(HometownGenerationDto,data),profile=await this.profileBinding(userId,dto),place=hometownPlace(dto.placeId);
    if(!place)throw new BadRequestException("Select a Belgian town from the supplied list");
    const previous=await this.prisma.preparationGeneration.findUnique({where:{userId_requestKey:{userId,requestKey:dto.requestKey}}});
    if(previous) { if(previous.state==="SUCCEEDED"&&previous.resultId)return this.getRoute(userId,previous.resultId);throw new ConflictException("This request was already reserved. Reload its status; it will not spend provider requests again."); }
    const daily=budgetValue("HOMETOWN_DAILY_REQUEST_BUDGET",1000),monthly=budgetValue("HOMETOWN_MONTHLY_REQUEST_BUDGET",10000);
    if(!daily||!monthly||!(process.env.MAPBOX_DIRECTIONS_TOKEN??process.env.NEXT_PUBLIC_MAPBOX_TOKEN))throw new ServiceUnavailableException("Hometown routing is not enabled within an approved provider allowance. No requests were made.");
    const now=new Date(),day=now.toISOString().slice(0,10),month=day.slice(0,7);
    await this.prisma.$transaction(async tx=>{
      await tx.$queryRawUnsafe('SELECT "id" FROM "User" WHERE "id"=$1 FOR UPDATE',userId);
      if(await tx.preparationGeneration.findFirst({where:{userId,createdAt:{gt:new Date(now.getTime()-300_000)}}}))throw new HttpException("Please wait five minutes before another hometown generation.",429);
      for(const [bucket,limit] of [[`month:${month}`,monthly],[`day:${day}`,daily]] as const) {
        await tx.preparationRoutingBudget.upsert({where:{bucket},create:{bucket,reserved:0},update:{}});
        await tx.$queryRawUnsafe('SELECT "bucket" FROM "PreparationRoutingBudget" WHERE "bucket"=$1 FOR UPDATE',bucket);
        const used=await tx.preparationRoutingBudget.findUniqueOrThrow({where:{bucket}});
        if(used.reserved+MAX_REQUESTS>limit)throw new HttpException("The approved routing allowance has been reserved. No paid expansion or extra search will run.",429);
        await tx.preparationRoutingBudget.update({where:{bucket},data:{reserved:{increment:MAX_REQUESTS}}});
      }
      await tx.preparationGeneration.create({data:{userId,requestKey:dto.requestKey}});
    });
    try {
      let best: PrivateSnapshot|null=null,calls=0;
      const anchor:[number,number]=[place.longitude,place.latitude];
      // Four search shapes, each at most one final snapped-point validation.
      for(const candidate of loopCandidates(place.latitude,place.longitude,0,[1800,2700,3600,4500])) {
        if(calls>=MAX_REQUESTS)break;
        const raw=await this.driving.evaluate(candidate,1000);calls++;
        if(raw.issues.some(i=>["ROUTING_NOT_CONFIGURED","ROUTING_UNAVAILABLE"].includes(i)))break;
        if(!raw.snappedPoints||raw.coordinates.length<4)continue;
        const cycles=raw.valid?[]:simpleRoadCycles(raw.coordinates);
        const points=cycles.length?cycleWaypoints(cycles[0],anchor):removeSharedAccessStem(raw.coordinates,raw.snappedPoints);
        const checked=await this.driving.evaluate(points);calls++;
        const snapshot=checkedPrivateSnapshot(checked,points,anchor);
        if(!snapshot)continue;
        const score=(s:PrivateSnapshot)=>profile.focus.items.filter(i=>s.observedFeatures.includes(i.code)).length;
        if(!best||score(snapshot)>score(best))best=snapshot;
        if(score(snapshot)>0||!profile.focus.items.length)break;
      }
      if(!best)throw new BadRequestException("No safe, connected 23–27 minute loop passed the bounded search. Nothing was fabricated or published. Try later or discuss another town with your instructor.");
      await this.profileBinding(userId,dto); // A purchase/profile can change while the provider is running.
      const saved=await this.prisma.$transaction(async tx=>{
        await tx.$queryRawUnsafe('SELECT "id" FROM "User" WHERE "id"=$1 FOR UPDATE',userId);
        const current=await tx.preparationProfile.findUnique({where:{userId}});
        if(current?.revision!==profile.revision)throw new ConflictException("Preparation changed during generation. No private route was saved.");
        const route=await tx.hometownRoute.create({data:{userId,sourceCentreId:profile.centreId!,placeId:place.id,placeName:place.name,level:profile.preferredLevel,focusCodes:profile.focus.items.map(i=>i.code),snapshot:asJson(best),expiresAt:new Date(Date.now()+30*86400_000)}});
        await tx.preparationGeneration.update({where:{userId_requestKey:{userId,requestKey:dto.requestKey}},data:{state:"SUCCEEDED",resultId:route.id}});
        await tx.auditLog.create({data:{userId,action:"PRIVATE_HOMETOWN_GENERATED",entity:"HometownRoute",entityId:route.id,metadata:{boundedRequests:calls,routePublished:false}}});
        return route;
      });
      return this.getRoute(userId,saved.id);
    }catch(e){await this.prisma.preparationGeneration.updateMany({where:{userId,requestKey:dto.requestKey,state:"PENDING"},data:{state:"FAILED"}});throw e;}
  }
  async list(userId: string) {
    const rows=await this.prisma.hometownRoute.findMany({where:{userId},orderBy:{createdAt:"desc"},take:20,select:{id:true,placeName:true,createdAt:true,expiresAt:true,level:true}});
    return {ownerId:userId,routes:rows};
  }
  async getRoute(userId: string,id: string) {
    const row=await this.prisma.hometownRoute.findFirst({where:{id,userId}});
    if(!row)throw new NotFoundException("Private route not found");
    await this.requirePaid(userId,row.sourceCentreId);
    if(row.expiresAt<=new Date())throw new ForbiddenException("This private route needs a fresh driving check after 30 days. Its history is preserved.");
    const sessions=await this.prisma.hometownSession.findMany({where:{userId,routeId:id},orderBy:{startedAt:"desc"},take:10,select:{id:true,startedAt:true,completedAt:true,completionPct:true,completionKind:true,reflection:true}});
    const snapshot=row.snapshot as unknown as PrivateSnapshot;
    return {id:row.id,ownerId:userId,placeName:row.placeName,level:row.level,createdAt:row.createdAt,expiresAt:row.expiresAt,snapshot,focusCodes:row.focusCodes,matchedFocus:row.focusCodes.filter(c=>snapshot.observedFeatures.includes(c)),unknownFocus:row.focusCodes.filter(c=>!snapshot.observedFeatures.includes(c)),sessions,label:"Private hometown road-network practice · not an official exam route",evidence:"Road features are provider-reported manoeuvres, not instructor-reviewed hazards or current signs. A town marker is not a safe stopping place. Inspect the start while parked.",attribution:"Town data © GeoNames, CC BY 4.0. Road routing: Mapbox."};
  }
  async remove(userId: string,id: string, data: PrivateSessionDto) {
    const dto=input(PrivateSessionDto,data);if(dto.ownerId!==userId)throw new ConflictException("Account changed");
    // Deletion stays available after entitlement/route expiry.
    const removed=await this.prisma.hometownRoute.deleteMany({where:{id,userId}});
    if(!removed.count)throw new NotFoundException("Private route not found");
    return {deleted:true};
  }
  async start(userId:string,id:string,data:PrivateSessionDto) {
    const dto=input(PrivateSessionDto,data);if(dto.ownerId!==userId)throw new ConflictException("Account changed");
    await this.getRoute(userId,id);
    return this.prisma.$transaction(async tx=>{
      await tx.$queryRawUnsafe('SELECT "id" FROM "User" WHERE "id"=$1 FOR UPDATE',userId);
      const active=await tx.hometownSession.findFirst({where:{userId,routeId:id,completedAt:null}});
      return active??tx.hometownSession.create({data:{userId,routeId:id}});
    });
  }
  async track(userId:string,id:string,data:CreateTrackPointDto) {
    const dto=input(CreateTrackPointDto,data);
    const session=await this.prisma.hometownSession.findFirst({where:{id,userId},include:{route:true}});
    if(!session)throw new NotFoundException("Private session not found");
    await this.requirePaid(userId,session.route.sourceCentreId);
    if(session.route.expiresAt<=new Date())throw new ForbiddenException("Private route needs a fresh check");
    return this.prisma.$transaction(async tx=>{
      await tx.$queryRawUnsafe('SELECT "id" FROM "HometownSession" WHERE "id"=$1 AND "userId"=$2 FOR UPDATE',id,userId);
      const current=await tx.hometownSession.findFirstOrThrow({where:{id,userId}});
      if(current.completedAt)throw new BadRequestException("Private practice has ended");
      const now=new Date(),age=dto.recordedAt?now.getTime()-Date.parse(dto.recordedAt):0;
      if(age>60000||age< -15000)return {accepted:false,reason:"STALE_GPS"};
      if(current.lastSampleAt&&now.getTime()-current.lastSampleAt.getTime()<1000)return {accepted:false,reason:"GPS_THROTTLED"};
      const snapshot=session.route.snapshot as unknown as PrivateSnapshot;
      const result=trackProgress(snapshot,current.progressM,current.visitedPoints,[dto.longitude,dto.latitude],dto.accuracyM,current.lastSampleAt?(now.getTime()-current.lastSampleAt.getTime())/1000:1);
      if(!result.accepted)return result;
      const completionPct=Math.max(current.completionPct,Math.min(99,Math.floor(result.progressM/snapshot.distanceM*100)));
      await tx.hometownSession.update({where:{id},data:{progressM:result.progressM,visitedPoints:result.visited,completionPct,lastSampleAt:now}});
      return {accepted:true,completionPct,visitedPoints:result.visited};
    });
  }
  async end(userId:string,id:string,data:PrivateSessionDto) {
    const dto=input(PrivateSessionDto,data);if(dto.ownerId!==userId)throw new ConflictException("Account changed");
    return this.prisma.$transaction(async tx=>{
      await tx.$queryRawUnsafe('SELECT "id" FROM "HometownSession" WHERE "id"=$1 AND "userId"=$2 FOR UPDATE',id,userId);
      const s=await tx.hometownSession.findFirst({where:{id,userId},include:{route:true}});if(!s)throw new NotFoundException("Private session not found");if(s.completedAt){const {route,...ended}=s;return ended;}
      const snap=s.route.snapshot as unknown as PrivateSnapshot,finished=s.visitedPoints>=snap.points.length&&s.progressM>=snap.distanceM*.95;
      const ended=await tx.hometownSession.update({where:{id},data:{completedAt:new Date(),completionPct:finished?100:s.completionPct,completionKind:finished?"COMPLETED":"ENDED"}});
      // Never return the included route snapshot from this history/end endpoint.
      return ended;
    });
  }
  async reflect(userId:string,id:string,data:HometownReflectionDto) {
    const dto=input(HometownReflectionDto,data);if(dto.ownerId!==userId)throw new ConflictException("Account changed");
    const s=await this.prisma.hometownSession.findFirst({where:{id,userId,completedAt:{not:null}}});if(!s)throw new NotFoundException("Ended private session not found");
    const reflectedAt=new Date();
    await this.prisma.hometownSession.update({where:{id},data:{reflectedAt,reflection:asJson({difficultyCategories:dto.difficultyCategories,instructorCategories:dto.instructorCategories,instructorFeedback:dto.instructorCategories.length>0,savedAt:reflectedAt.toISOString()})}});
    return {saved:true};
  }
}
