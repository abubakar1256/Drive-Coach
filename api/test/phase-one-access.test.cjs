require('reflect-metadata');
const test=require('node:test'), assert=require('node:assert/strict');
const {planTier,validSubscription}=require('../dist/src/billing/access-policy');
const {BillingService}=require('../dist/src/billing/billing.service');
const {RouteAccessService}=require('../dist/src/routes/route-access.service');
const {RoutesService}=require('../dist/src/routes/routes.service');
const {LearningService}=require('../dist/src/learning/learning.service');
const {centreRouteCatalog}=require('../dist/src/exam-centres/exam-centres.service');
const {MediaService}=require('../dist/src/media/media.service');

test('legacy names never silently acquire a wider scope',()=>{
  for(const [plan,tier] of [[{name:'Premium'},'Basic'],[{name:'Diamond'},'Premium'],[{name:'Basic'},'Basic'],[{name:'Premium 1 day',tier:'Premium'},'Premium'],[{name:'Premium',tier:'Unknown'},null],[{name:'Unknown'},null]])assert.equal(planTier(plan),tier);
});
test('revoked, expired and future grants fail closed even if returned by a mock/database',()=>{
  const now=new Date();
  for(const s of [{status:'REFUNDED',startsAt:null,expiresAt:null},{status:'ACTIVE',startsAt:null,expiresAt:now},{status:'ACTIVE',startsAt:new Date(+now+1),expiresAt:null}])assert.equal(validSubscription(s,now),false);
});
test('catalogue grants only the selected trial route, not Route A at every centre',()=>{
  const centre={name:'Test',city:'Test',region:'Test',routes:[{id:'a',points:[{title:'secret A'}]},{id:'b',points:[{title:'secret B'}]}]};
  const result=centreRouteCatalog(centre,{premium:false,plan:'Free',trial:{available:false,active:true,routeId:'b',expiresAt:new Date(Date.now()+1000)}},true);
  assert.deepEqual(result.routes.map(r=>r.canAccess),[false,true]);
  assert.equal(result.routes[0].points.length,0); assert.equal(result.routes[1].points.length,1);
  assert.equal(result.premiumInfo,null);
});
test('public metadata redacts snapped road coordinates as well as geometry and points',async()=>{
  const route={id:'a',points:[{latitude:50,longitude:5}]};
  const result=await new RoutesService({route:{findFirst:async()=>route}},{evaluate:async()=>({valid:true,issues:[],durationSec:1500,distanceM:10000,coordinates:[[5,50]],snappedPoints:[{latitude:50,longitude:5,name:'PRIVATE ROAD'}]})},{}).getBySlug('a');
  assert.deepEqual(result.points,[]); assert.deepEqual(result.driving.coordinates,[]); assert.equal(result.driving.snappedPoints,undefined);
});
test('API does not return geometry if access expires during routing',async()=>{
  const service=new RoutesService({route:{findFirst:async()=>({id:'r',points:[]})}},{evaluate:async()=>({durationSec:1500})},{requireAccess:async()=>({premium:true,expiresAt:new Date(Date.now()-1)})});
  await assert.rejects(service.getAccessibleBySlug('u','r'),/expired/);
});
test('ongoing practice cannot submit more GPS after route access is revoked',async()=>{
  const tx={$queryRawUnsafe:async()=>[],practiceSession:{findFirst:async()=>({routeId:'r',completedAt:null})},practiceTrackPoint:{create:async()=>assert.fail('must not store')}};
  const service=new LearningService({$transaction:fn=>fn(tx)},null,{requireAccess:async()=>{throw Error('Access revoked');}});
  await assert.rejects(service.recordTrackPoint('u','s',{}),/revoked/);
});
test('unknown and retired offers are not listed, missing prices remain unpurchasable',async()=>{
  const service=new BillingService({plan:{findMany:async()=>[{id:'old',name:'Premium',tier:'Basic',durationHours:2160,priceCents:1499,isActive:false},{id:'new',name:'Basic 1 day',tier:'Basic',durationHours:24,priceCents:0,isActive:true},{name:'Unknown',durationHours:24,priceCents:1,isActive:true}]}});
  assert.deepEqual(await service.listPlans(),[{id:'new',name:'Basic',durationHours:24,priceCents:null,currency:undefined,purchasable:false}]);
});
test('new Basic checkout snapshots authoritative price, centre, tier and duration',async()=>{
  const previous=process.env.STRIPE_SECRET_KEY, originalFetch=global.fetch;
  process.env.STRIPE_SECRET_KEY='test-only';
  try{
    for(const [tier,prices] of [['Basic',[200,400,600,800]],['Premium',[300,600,900,1200]]])for(const [i,hours] of [24,168,720,2160].entries()){
      const writes=[];let form;
      const prisma={plan:{findUnique:async()=>({id:'offer',name:`${tier} offer`,tier,durationHours:hours,priceCents:prices[i],currency:'EUR',isActive:true})},examCentre:{findFirst:async()=>({id:'c'})},user:{findUnique:async()=>({email:'test@example.invalid'})},$executeRawUnsafe:async(...args)=>{writes.push(args);return 1;}};
      const service=new BillingService(prisma);service.subscription=async()=>({status:'FREE',plan:'Free'});
      global.fetch=async(url,options)=>{assert.equal(url,'https://api.stripe.com/v1/checkout/sessions');form=options.body;return{ok:true,json:async()=>({id:'cs',url:'https://checkout.stripe.com/test'})};};
      await service.checkout('u',{planId:'offer',centreId:'c',priceCents:1,durationHours:9999});
      assert.equal(form.get('line_items[0][price_data][unit_amount]'),String(prices[i]));
      const metadata=JSON.parse(writes[0][6]);assert.equal(metadata.tier,tier);assert.equal(metadata.durationHours,hours);assert.equal(metadata.centreId,tier==='Basic'?'c':null);
    }
  }finally{global.fetch=originalFetch;if(previous===undefined)delete process.env.STRIPE_SECRET_KEY;else process.env.STRIPE_SECRET_KEY=previous;}
});
test('server rejects missing Basic centre and inactive/unpriced/unknown periods before payment writes',async()=>{
  const previous=process.env.STRIPE_SECRET_KEY;process.env.STRIPE_SECRET_KEY='test-only';
  try{
    for(const overrides of [{isActive:false},{priceCents:0},{durationHours:25},{tier:'Other'},{}]){
      const service=new BillingService({plan:{findUnique:async()=>({name:'Basic 1 day',tier:'Basic',durationHours:24,priceCents:200,isActive:true,...overrides})},$executeRawUnsafe:async()=>assert.fail('No payment should be written')});
      service.subscription=async()=>({status:'FREE',plan:'Free'});await assert.rejects(service.checkout('u',{planId:'p'}));
    }
  }finally{if(previous===undefined)delete process.env.STRIPE_SECRET_KEY;else process.env.STRIPE_SECRET_KEY=previous;}
});
test('webhook honours the captured purchase period, not a later offer price/duration',async()=>{
  let written;
  const tx={$queryRawUnsafe:async()=>[{id:'payment'}],payment:{findUnique:async()=>({id:'payment',userId:'u',planId:'p',status:'PENDING',amountCents:200,currency:'EUR',metadata:{tier:'Basic',centreId:'c',durationHours:24},plan:{name:'Changed',tier:'Premium',durationHours:2160,priceCents:9999}}),update:async()=>{}},subscription:{create:async({data})=>{written=data;return{id:'s',...data};}},referralAttribution:{findUnique:async()=>null},notification:{createMany:async()=>{}}};
  await new BillingService({}).completeCheckout(tx,{id:'cs',payment_status:'paid',amount_total:200,currency:'eur'});
  assert.equal(written.centreId,'c');assert.equal(written.expiresAt-written.startsAt,86400000);
});
test('longest applicable route grant survives shorter overlapping purchases',async()=>{
  const later=new Date(Date.now()+50000);
  const service=new RouteAccessService({user:{findUnique:async()=>({role:'LEARNER'})},subscription:{findMany:async()=>[{status:'ACTIVE',startsAt:null,expiresAt:new Date(Date.now()+1000),centreId:null,plan:{tier:'Premium'}},{status:'ACTIVE',startsAt:null,expiresAt:later,centreId:'c',plan:{tier:'Basic'}}]}});
  assert.equal((await service.centreAccess('u','c')).expiresAt,later);
});
test('media requires paid access for its exact route before any bytes are read',async()=>{
  for(const mode of ['trial','wrong-centre','paid']){
    let bytesRead=false;
    const db={mediaAsset:{findUnique:async args=>args.select.dataBytes?{dataBytes:Buffer.from('test')}:{routePoint:{routeId:'private-route'}}},user:{findUnique:async()=>({role:'LEARNER'})},$queryRawUnsafe:async()=>{bytesRead=true;return[{storageKey:'database:asset',mimeType:'image/png',originalName:'test.png'}];}};
    const access={requireAccess:async(user,route)=>{assert.equal(user,'u');assert.equal(route,'private-route');if(mode==='wrong-centre')throw Error('Wrong centre');return{premium:mode==='paid'};}};
    const service=new MediaService(db,access);
    if(mode==='paid'){const file=await service.file('u','asset');assert.equal(file.buffer.toString(),'test');assert.equal(bytesRead,true);}
    else{await assert.rejects(service.file('u','asset'));assert.equal(bytesRead,false);}
  }
});
test('media JWT guard and module dependencies resolve without an external service',async()=>{
  const {Test}=require('@nestjs/testing');const {MediaModule}=require('../dist/src/media/media.module');const {MediaController}=require('../dist/src/media/media.controller');const {JwtAuthGuard}=require('../dist/src/auth/auth.guard');const {PrismaService}=require('../dist/src/prisma.service');
  assert.ok(Reflect.getMetadata('__guards__',MediaController.prototype.serve).includes(JwtAuthGuard));
  const module=await Test.createTestingModule({imports:[MediaModule]}).overrideProvider(PrismaService).useValue({}).compile();
  try{assert.ok(module.get(MediaService));}finally{await module.close();}
});
