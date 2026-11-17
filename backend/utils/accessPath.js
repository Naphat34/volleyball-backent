const {denied}=require('./accessScope');

// Express decodes each route parameter once. ACLs must inspect that same value.
function accessPath(path){
    if(typeof path!=='string'||!path.startsWith('/'))throw denied('Invalid request path',400);
    try{
        return path.split('/').map(segment=>{
            const decoded=decodeURIComponent(segment);
            if(decoded.includes('/')||decoded.includes('\\')||decoded.includes('\0'))throw Error('Invalid segment');
            return decoded;
        }).join('/').replace(/\/+$/,'')||'/';
    }catch{throw denied('Invalid request path',400);}
}
module.exports={accessPath};
