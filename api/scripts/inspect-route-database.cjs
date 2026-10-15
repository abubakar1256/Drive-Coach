const {PrismaClient} = require('@prisma/client');
const prisma = new PrismaClient({log: []});
(async () => {
  const version = await prisma.$queryRawUnsafe("SHOW server_version");
  const routes = await prisma.route.findMany({where: {status: 'PUBLISHED', centre: {isPublished: true}}, select: {id: true, slug: true, reviewedBy: true, verificationStatus: true, points: {select: {id: true, imageUrl: true, videoUrl: true, _count: {select: {features: true, mediaAssets: true}}}}}});
  const ids = routes.map(route => route.id);
  const groups = await prisma.route.findMany({where:{status:'PUBLISHED',centre:{isPublished:true}},select:{slug:true,durationMin:true,reviewedBy:true,verificationStatus:true,points:{where:{features:{some:{}}},select:{sequence:true,_count:{select:{features:true}}}}}});
  console.log(JSON.stringify({contentRequiringPreservation:groups.filter(r=>r.points.length || r.reviewedBy!=='ROAD_ROUTING_ENGINE' || r.verificationStatus!=='ROAD_VALIDATED')},null,2));
  console.log(JSON.stringify({serverVersion: version[0].server_version, publishedRoutes: routes.length, routePoints: routes.reduce((n,r)=>n+r.points.length,0), mediaAssets: routes.reduce((n,r)=>n+r.points.reduce((s,p)=>s+p._count.mediaAssets,0),0), pointFeatures: routes.reduce((n,r)=>n+r.points.reduce((s,p)=>s+p._count.features,0),0), mediaLinks: routes.reduce((n,r)=>n+r.points.filter(p=>p.imageUrl || p.videoUrl).length,0), activeSessions: await prisma.practiceSession.count({where:{routeId:{in:ids},completedAt:null}}), totalSessions:await prisma.practiceSession.count({where:{routeId:{in:ids}}}), generatedOnly:routes.every(r=>r.reviewedBy==='ROAD_ROUTING_ENGINE'&&r.verificationStatus==='ROAD_VALIDATED')},null,2));
})().catch(error => {console.error(`Read-only inspection failed (${error.code || error.name}); sensitive details omitted.`); process.exitCode=1;}).finally(()=>prisma.$disconnect());
