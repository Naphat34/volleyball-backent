const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function adminMatchPath(publicId){
    return typeof publicId==='string'&&uuidPattern.test(publicId)?`/admin-matches/${publicId.toLowerCase()}`:null;
}
// Normalize only an authorized UUID link; integer deep links are unsupported.
export function authorizedAdminMatchLocation(match,location){
    const current=location.pathname.match(/^\/admin-matches\/([^/]+)\/?$/)?.[1]?.toLowerCase();
    if(!match||!uuidPattern.test(current||'')||String(match.public_id).toLowerCase()!==current)return null;
    const pathname=adminMatchPath(match?.public_id);
    return pathname&&pathname!==location.pathname?{pathname,search:location.search,hash:location.hash}:null;
}
