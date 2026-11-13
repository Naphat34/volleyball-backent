const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const jwt = require('jsonwebtoken');
const secret = 'test-only-secret-for-token-selection';
const file = require.resolve('../middleware/authMiddleware');
const localRequire = createRequire(file);
function middleware() {
    const scope = { exports: {}, console, require: name => name === '../config/security'
        ? {getJwtSecret:()=>secret} : name === '../config/db' ? {query:async()=>({rows:[]})} : localRequire(name) };
    vm.runInNewContext(fs.readFileSync(file,'utf8'),scope,{filename:file});
    return scope.exports;
}
const response = () => ({code:200,status(code){this.code=code;return this;},json(data){this.data=data;}});

test('explicit scorer Bearer token takes precedence over an old admin cookie', () => {
    const req = {headers:{authorization:'Bearer '+jwt.sign({id:2,role:'scorer'},secret)},cookies:{token:jwt.sign({id:1,role:'admin'},secret)}};
    const res = response(); let accepted = false;
    middleware().verifyToken(req,res,()=>{accepted=true;});
    assert.equal(accepted,true);
    assert.equal(req.user.id,2);
    assert.equal(req.user.role,'scorer');
});

test('invalid Bearer token cannot fall back to a different account cookie', () => {
    const req = {headers:{authorization:'Bearer invalid'},cookies:{token:jwt.sign({id:1,role:'admin'},secret)}};
    const res = response(); let accepted = false;
    middleware().verifyToken(req,res,()=>{accepted=true;});
    assert.equal(accepted,false);
    assert.equal(res.code,403);
});

test('cookie-only authentication remains supported', () => {
    const req = {headers:{},cookies:{token:jwt.sign({id:3,role:'team_staff'},secret)}};
    middleware().verifyToken(req,response(),()=>{});
    assert.equal(req.user.id,3);
});
