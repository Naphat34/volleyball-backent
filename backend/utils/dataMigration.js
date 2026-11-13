const {createHash}=require('node:crypto');
const jsonNumber=Symbol('jsonNumber');
function numeric(value){
    const match=String(value).match(/^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i);
    if(!match)throw Error('Unsupported numeric representation');
    let digits=(match[2]+(match[3]||'')).replace(/^0+/,'');
    let exponent=BigInt(match[4]||0)-BigInt((match[3]||'').length);
    if(!digits)return '0';
    while(digits.endsWith('0')){digits=digits.slice(0,-1);exponent++;}
    return match[1]+digits+'e'+exponent;
}
function stableJson(input){
    const value=JSON.parse(typeof input==='string'?input:JSON.stringify(input),(key,item,context)=>{
        if(typeof item!=='number')return item;
        if(!context?.source)throw Error('JSON verification requires Node.js 22+');
        return {[jsonNumber]:numeric(context.source)};
    });
    function encode(item){
        if(item===null)return 'null';
        if(typeof item!=='object')return JSON.stringify(item);
        if(item[jsonNumber]!==undefined)return 'number:'+item[jsonNumber];
        if(Array.isArray(item))return '['+item.map(encode).join(',')+']';
        return '{'+Object.keys(item).sort().map(key=>JSON.stringify(key)+':'+encode(item[key])).join(',')+'}';
    }
    return encode(value);
}
function canonical(value,type){
    if(value===null||value===undefined)return null;
    if(type==='json'||type==='jsonb')return stableJson(value);
    if(/^(tinyint|smallint|mediumint|int|integer|bigint|decimal|numeric|float|double|real|double precision)$/.test(type))return numeric(value);
    if(/^(timestamp|datetime|timestamp with time zone|timestamp without time zone)$/.test(type))
        return String(value).replace(' ','T').replace(/(?:Z|\+00(?::00)?)$/,'').replace(/\.0+$/,'').replace(/(\.\d*?[1-9])0+$/,'$1');
    if(type==='time'||type==='time without time zone')return String(value).replace(/\.0+$/,'').replace(/(\.\d*?[1-9])0+$/,'$1');
    return String(value);
}
function rowHash(row,columns){
    return createHash('sha256').update(JSON.stringify(columns.map(c=>[c.COLUMN_NAME,canonical(row[c.COLUMN_NAME],c.DATA_TYPE)]))).digest('hex');
}
function tableHash(rows,columns){
    return createHash('sha256').update(rows.map(row=>rowHash(row,columns)).sort().join('\n')).digest('hex');
}
function insertOrder(tables,keys){
    const pending=new Set(tables),result=[];
    while(pending.size){
        const ready=[...pending].filter(table=>!keys.some(key=>key.TABLE_NAME===table&&key.REFERENCED_TABLE_NAME&&key.REFERENCED_TABLE_NAME!==table&&pending.has(key.REFERENCED_TABLE_NAME)&&!(table==='users'&&key.COLUMN_NAME==='team_id')));
        if(!ready.length)throw Error('Unsupported foreign-key cycle');
        for(const table of ready){result.push(table);pending.delete(table);}
    }
    return result;
}
module.exports={canonical,stableJson,numeric,rowHash,tableHash,insertOrder};
