// Incident-only fallback: product45 code + database43-compatible generated client from pinned46.
// Keep both immutable release directories. Never reverse migrations or restore away new rows.
const path=require('node:path');const Module=require('node:module');
const ROOT='/opt/brokeriq/releases/rc-5cbd17279520/apps/api';
const CLIENT='/opt/brokeriq/releases/rc-e0442adbc140/apps/api/node_modules/@prisma/client';
const client=require(CLIENT);
if(client.FollowUpType.SMS!=='SMS')throw Error('Recovery database client lacks required SMS compatibility');
const load=Module._load;
Module._load=function(spec,parent,main){
 if(spec==='@prisma/client'&&parent?.filename.startsWith(ROOT+'/dist/'))return client;
 return load.call(this,spec,parent,main);
};
process.env.JOBS_ENABLED='false';
const core=require(ROOT+'/node_modules/@nestjs/core');const create=core.NestFactory.create.bind(core.NestFactory);
core.NestFactory.create=async(...args)=>{const app=await create(...args);app.use((req,res,next)=>{
 const url=req.url.split('?')[0];
 if((req.method==='POST'&&(url==='/api/follow-ups'||url==='/api/leads/bulk'))||/^\/api\/leads\/[^/]+\/assign$/.test(url)||url.startsWith('/api/assistant/'))
  return res.status(503).json({statusCode:503,code:'RELEASE_RECOVERY_PAUSED',message:'यह action release recovery के दौरान paused है। आपका data सुरक्षित है।'});
 next();});return app;};
if(require.main===module)require(ROOT+'/dist/src/main.js');
