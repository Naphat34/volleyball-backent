const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const mysql=require('mysql2/promise');
const dotenv=require('dotenv');
const {Client,types}=require('pg');
const {poolOptions}=require('../config/postgres');
const {insertOrder,tableHash}=require('../utils/dataMigration');
const backend=path.join(__dirname,'..');
const quote=name=>'"'+name.replaceAll('"','""')+'"';
const mysqlQuote=name=>'`'+name.replaceAll('`','``')+'`';
const ignored=new Set(['schema_migrations','seed_migrations']);

async function readSource(){
    const file=path.join(backend,'mysql-source.env');
    if(!fs.existsSync(file))throw Error('Create backend/mysql-source.env with the original MySQL settings');
    const env=dotenv.parse(fs.readFileSync(file));
    for(const key of ['DB_HOST','DB_USER','DB_PASSWORD','DB_NAME'])if(!env[key])throw Error('Missing source '+key);
    const connection=await mysql.createConnection({host:env.DB_HOST,port:Number(env.DB_PORT||3306),user:env.DB_USER,password:env.DB_PASSWORD,database:env.DB_NAME,
        connectTimeout:10000,dateStrings:true,supportBigNumbers:true,bigNumberStrings:true,jsonStrings:true,
        ssl:env.DB_SSL==='true'?{rejectUnauthorized:env.DB_SSL_REJECT_UNAUTHORIZED!=='false',...(env.DB_SSL_CA_FILE?{ca:fs.readFileSync(env.DB_SSL_CA_FILE,'utf8')}:{})}:undefined});
    try{
        await connection.query("SET time_zone = '+00:00'");
        await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
        const [tables]=await connection.query("SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'");
        const [columns]=await connection.query('SELECT TABLE_NAME,COLUMN_NAME,DATA_TYPE,EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,ORDINAL_POSITION');
        const [keys]=await connection.query('SELECT TABLE_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL');
        const snapshot={format:1,capturedAt:new Date().toISOString(),columns:columns.filter(c=>!ignored.has(c.TABLE_NAME)),keys:keys.filter(k=>!ignored.has(k.TABLE_NAME)),tables:{}};
        for(const {TABLE_NAME:table,ENGINE:engine}of tables.filter(t=>!ignored.has(t.TABLE_NAME)).sort((a,b)=>a.TABLE_NAME.localeCompare(b.TABLE_NAME))){
            if(engine!=='InnoDB')throw Error('Consistent snapshot requires InnoDB: '+table);
            snapshot.tables[table]=(await connection.query('SELECT * FROM '+mysqlQuote(table)))[0];
        }
        await connection.rollback();return snapshot;
    }finally{await connection.end();}
}

async function transfer(snapshot,client,{apply=false,inspect=false}={}){
    const schema=process.env.DB_PG_SCHEMA||'volley';
    if(schema!=='volley')throw Error('Data transfer requires the reviewed volley staging schema');
    const tables=Object.keys(snapshot.tables);
    const targetColumns=(await client.query('SELECT table_name,column_name,is_generated,data_type FROM information_schema.columns WHERE table_schema=$1 ORDER BY table_name,ordinal_position',[schema])).rows;
    const targetTables=[...new Set(targetColumns.map(c=>c.table_name))];
    if(JSON.stringify([...tables].sort())!==JSON.stringify([...targetTables].sort()))throw Error('Source and target application table sets differ');
    for(const table of tables){
        const original=snapshot.columns.filter(c=>c.TABLE_NAME===table).map(c=>c.COLUMN_NAME).sort();
        const target=targetColumns.filter(c=>c.table_name===table && !(c.column_name==='public_id'&&c.data_type==='uuid'&&!original.includes('public_id'))).map(c=>c.column_name).sort();
        if(JSON.stringify(original)!==JSON.stringify(target))throw Error('Column sets differ for '+table);
    }
    const summary=tables.map(table=>({table,sourceRows:snapshot.tables[table].length}));
    if(inspect){
        for(const row of summary)row.targetRows=Number((await client.query(`SELECT count(*) FROM ${quote(schema)}.${quote(row.table)}`)).rows[0].count);
        return {status:'inspected',tables:summary};
    }
    let active=false;
    try{
        await client.query('BEGIN');active=true;
        await client.query("SET LOCAL TIME ZONE 'UTC'");
        await client.query("SET LOCAL lock_timeout='5s'");
        await client.query("SELECT pg_advisory_xact_lock(hashtext('volley_data_migration'))");
        await client.query('LOCK TABLE '+tables.map(t=>quote(schema)+'.'+quote(t)).join(',')+' IN ACCESS EXCLUSIVE MODE');
        for(const table of tables){
            const count=Number((await client.query(`SELECT count(*) FROM ${quote(schema)}.${quote(table)}`)).rows[0].count);
            if(table!=='age_groups'&&count)throw Error('Target contains existing application data; refusing overwrite: '+table);
        }
        const ages=(await client.query('SELECT id,name,name_th,name_en FROM volley.age_groups')).rows;
        if(ages.some(row=>!['U12','U14','U16','U18','Open'].includes(row.name)||row.name_th!==null||row.name_en!==null)||ages.length>5)throw Error('Target age groups differ from seed defaults; refusing overwrite');
        await client.query('DELETE FROM volley.age_groups');
        const order=insertOrder(tables,snapshot.keys);
        for(const table of order){
            const columns=snapshot.columns.filter(c=>c.TABLE_NAME===table&&!/\b(?:VIRTUAL|STORED) GENERATED\b/i.test(c.EXTRA));
            for(let start=0;start<snapshot.tables[table].length;start+=200){
                const batch=snapshot.tables[table].slice(start,start+200),values=[];
                const groups=batch.map(row=>'('+columns.map(column=>{
                    let value=row[column.COLUMN_NAME];
                    if(table==='users'&&column.COLUMN_NAME==='team_id')value=null;
                    if(value!==null&&column.DATA_TYPE==='timestamp')value=String(value)+'+00:00';
                    values.push(value);return '$'+values.length;
                }).join(',')+')');
                await client.query(`INSERT INTO ${quote(schema)}.${quote(table)} (${columns.map(c=>quote(c.COLUMN_NAME)).join(',')}) VALUES ${groups.join(',')}`,values);
            }
        }
        for(const user of snapshot.tables.users||[])if(user.team_id!==null)await client.query('UPDATE volley.users SET team_id=$1 WHERE id=$2',[user.team_id,user.id]);
        // Table-wide row hashes include IDs, hashes of passwords, JSON and generated scopes.
        for(const row of summary){
            const columns=snapshot.columns.filter(c=>c.TABLE_NAME===row.table);
            const result=(await client.query(`SELECT * FROM ${quote(schema)}.${quote(row.table)}`)).rows;
            const original=tableHash(snapshot.tables[row.table],columns),target=tableHash(result,columns);
            if(result.length!==row.sourceRows||original!==target)throw Error('Reconciliation failed for '+row.table);
            row.targetRows=result.length;row.sha256=target;
        }
        for(const table of tables){
            const column=snapshot.columns.find(c=>c.TABLE_NAME===table&&/auto_increment/i.test(c.EXTRA));
            if(!column)continue;
            const sequence=(await client.query('SELECT pg_get_serial_sequence($1,$2) AS name',[schema+'.'+table,column.COLUMN_NAME])).rows[0].name;
            const maximum=(await client.query(`SELECT max(${quote(column.COLUMN_NAME)})::text AS maximum FROM ${quote(schema)}.${quote(table)}`)).rows[0].maximum;
            if(!sequence)throw Error('Missing target identity sequence for '+table);
            // ALTER SEQUENCE RESTART is transactional, unlike setval().
            const next=BigInt(maximum||0)+1n;
            const identifier=sequence.split('.').map(part=>quote(part.replaceAll('"',''))).join('.');
            await client.query(`ALTER SEQUENCE ${identifier} RESTART WITH ${next}`);
        }
        await client.query(apply?'COMMIT':'ROLLBACK');active=false;
        return {status:apply?'committed':'verified-and-rolled-back',capturedAt:snapshot.capturedAt,tables:summary};
    }catch(error){if(active)await client.query('ROLLBACK');throw error;}
}

async function run(){
    dotenv.config({path:path.join(backend,'.env'),quiet:true});
    if(!process.env.STAGING_DATABASE_URL)throw Error('STAGING_DATABASE_URL is required; production DATABASE_URL is never used');
    const snapshot=await readSource();
    const client=new Client({...poolOptions({...process.env,DATABASE_URL:process.env.STAGING_DATABASE_URL,DB_SSL:'true'}),types:{getTypeParser(oid,format){return [20,1082,1114,1184,1700,114,3802].includes(oid)&&format!=='binary'?value=>value:types.getTypeParser(oid,format);}}});
    try{
        await client.connect();
        const inspect=process.argv.includes('--inspect');
        const directory=path.join(backend,'../tmp/data-migration');
        let snapshotPath;
        if(!inspect){fs.mkdirSync(directory,{recursive:true});snapshotPath=path.join(directory,'source-'+randomUUID()+'.json');fs.writeFileSync(snapshotPath,JSON.stringify(snapshot),{mode:0o600,flag:'wx'});}
        const report=await transfer(snapshot,client,{inspect,apply:process.argv.includes('--apply')});
        if(!inspect)fs.writeFileSync(path.join(directory,'latest-report.json'),JSON.stringify({...report,snapshotFile:path.basename(snapshotPath)},null,2));
        console.log(JSON.stringify(report,null,2));
    }finally{await client.end();}
}
if(require.main===module)run().catch(error=>{console.error('Data migration failed:',error.code||error.message);process.exitCode=1;});
module.exports={readSource,transfer};
