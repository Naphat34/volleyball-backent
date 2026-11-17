const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const {localOptions,equivalentLiberoConstraint}=require('../scripts/migrateLocalAccess');
const {describe}=require('../scripts/adoptPostgresBaseline');
test('local access migration refuses remote URLs, other databases and other providers before connecting',()=>{
    const env={DB_PROVIDER:'postgres',DB_HOST:'localhost',DB_PORT:'5432',DB_USER:'fixture',DB_PASSWORD:'fixture',DB_NAME:'Volley_db2026',DB_SSL:'false'};
    assert.equal(localOptions(env).database,'Volley_db2026');
    for(const override of [{DATABASE_URL:'postgres://fixture:fixture@remote.example/postgres'},{DB_HOST:'remote.example'},
        {DB_NAME:'postgres'},{DB_PORT:'3306'},{DB_PROVIDER:'mysql'},{DB_PG_SCHEMA:'public'}])assert.throws(()=>localOptions({...env,...override}),/LOCAL_VOLLEY_DATABASE_REQUIRED/);
});
test('schema adoption only tolerates the specifically verified Libero cast difference, not another constraint',async()=>{
    const db=new PGlite();
    try{
        for(const schema of ['volley','volley_reference'])for(const file of ['001_baseline.sql','002_json_helpers.sql','003_public_uuid_identifiers.sql']){
            await db.exec(fs.readFileSync(path.join(__dirname,'../migrations/postgres',file),'utf8').replace(/\bvolley\b/g,schema));
        }
        const actual=await describe(db,'volley'),expected=await describe(db,'volley_reference');
        assert.equal(await equivalentLiberoConstraint(db,actual,expected,'volley_reference'),true);
        await db.exec("ALTER TABLE volley.users ADD CONSTRAINT unexpected_status CHECK(status<>'pending')");
        assert.equal(await equivalentLiberoConstraint(db,await describe(db,'volley'),expected,'volley_reference'),false);
    }finally{await db.close();}
});
