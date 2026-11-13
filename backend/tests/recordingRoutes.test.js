const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {roleHasPermission} = require('../config/permissions');
for (const file of ['../routes/scorerRoutes','../routes/customVisRoutes']) test(file + ' denies admin recording before controllers', () => {
 const entries=[], global=[];
 const router={use:(...args)=>{if(typeof args[0]!=='string')global.push(...args);}};
 for(const method of ['get','post','put','delete'])router[method]=(path,...handlers)=>entries.push({method,path,handlers:[...global,...handlers].flat(Infinity)});
 const pass=(req,res,next)=>next();
 const auth={verifyApprovedToken:[pass,pass],verifyToken:pass,canScoreMatches:(req,res,next)=>roleHasPermission(req.user.role,'match.score')?next():res.status(403).json({}),hasAnyRole:roles=>(req,res,next)=>roles.includes(req.user.role)?next():res.status(403).json({})};
 const controller=new Proxy({},{get:(_,key)=>key==='online'?()=>pass:pass});
 vm.runInNewContext(fs.readFileSync(require.resolve(file),'utf8'),{module:{exports:{}},require:name=>name==='express'?{Router:()=>router}:name.includes('authMiddleware')?auth:name.includes('validateRequest')?()=>pass:controller});
 const mutations=entries.filter(r=>['post','put','delete'].includes(r.method)&&!r.path.endsWith('/athletes'));
 assert.ok(mutations.length);
 for(const route of mutations){
  let status=200;
  const res={status(code){status=code;return this;},json(){}};
  for(const handler of route.handlers){let next=false;handler({user:{role:'admin'}},res,()=>{next=true;});if(!next)break;}
  assert.equal(status,403,route.method+' '+route.path);
 }
});
