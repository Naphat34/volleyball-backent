const fs=require('node:fs');
const path=require('node:path');
const dotenv=require('dotenv');
const {Client,types}=require('pg');
const {poolOptions}=require('../config/postgres');
const {tableHash}=require('../utils/dataMigration');
const quote=value=>'"'+value.replaceAll('"','""')+'"';
async function run(){
    dotenv.config({path:path.join(__dirname,'../.env'),quiet:true});
    if(!process.env.STAGING_DATABASE_URL)throw Error('STAGING_DATABASE_URL is required');
    const directory=path.join(__dirname,'../../tmp/data-migration');
    const report=JSON.parse(fs.readFileSync(path.join(directory,'latest-report.json'),'utf8'));
    if(report.status!=='committed'||path.basename(report.snapshotFile)!==report.snapshotFile)throw Error('No committed migration report');
    const snapshot=JSON.parse(fs.readFileSync(path.join(directory,report.snapshotFile),'utf8'));
    const client=new Client({...poolOptions({...process.env,DATABASE_URL:process.env.STAGING_DATABASE_URL,DB_SSL:'true'}),types:{getTypeParser(oid,format){return [20,1082,1114,1184,1700,114,3802].includes(oid)&&format!=='binary'?value=>value:types.getTypeParser(oid,format);}}});
    try{
        await client.connect();await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        await client.query("SET LOCAL TIME ZONE 'UTC'");
        for(const table of Object.keys(snapshot.tables)){
            const actual=(await client.query(`SELECT * FROM volley.${quote(table)}`)).rows;
            const columns=snapshot.columns.filter(c=>c.TABLE_NAME===table);
            if(actual.length!==snapshot.tables[table].length||tableHash(actual,columns)!==tableHash(snapshot.tables[table],columns))throw Error('Post-commit reconciliation failed: '+table);
            const identity=columns.find(c=>/auto_increment/i.test(c.EXTRA));
            if(identity){
                const sequence=(await client.query('SELECT pg_get_serial_sequence($1,$2) AS name',['volley.'+table,identity.COLUMN_NAME])).rows[0].name;
                const identifier=sequence.split('.').map(part=>quote(part.replaceAll('"',''))).join('.');
                const current=(await client.query(`SELECT last_value::text,is_called FROM ${identifier}`)).rows[0];
                const maximum=snapshot.tables[table].reduce((max,row)=>BigInt(row[identity.COLUMN_NAME])>max?BigInt(row[identity.COLUMN_NAME]):max,0n);
                if(current.is_called||BigInt(current.last_value)!==maximum+1n)throw Error('Identity sequence was not reset or target has new writes: '+table);
            }
        }
        await client.query('COMMIT');
        console.log(JSON.stringify({status:'post-commit-verified',tables:report.tables.length,rows:report.tables.reduce((n,t)=>n+t.targetRows,0),passwordHashesPreserved:true,identitySequencesVerified:true}));
    }finally{await client.end();}
}
if(require.main===module)run().catch(error=>{console.error('Verification failed:',error.code||error.message);process.exitCode=1;});
