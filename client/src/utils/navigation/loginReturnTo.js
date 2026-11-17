import { normalizeAccountRole } from '../../auth/roles.js';
const adminRoles=['super_admin','super_admin_scorer','super_admin_vims'];
// This is navigation eligibility only. Protected pages and APIs still enforce live scope.
export function loginReturnTo(search,user){
    const target=new URLSearchParams(search).get('returnTo');
    if(!target||!target.startsWith('/')||target.startsWith('//')||target.includes('\\')
        ||Array.from(target).some(char=>char.charCodeAt(0)<=32||char.charCodeAt(0)===127))return null;
    const url=new URL(target,'https://volley.invalid');
    const rawPath=target.split(/[?#]/,1)[0];
    if(url.origin!=='https://volley.invalid'||url.pathname!==rawPath||rawPath.includes('%'))return null;
    const role=normalizeAccountRole(user?.role),path=url.pathname;
    const uuid='[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
    const rules=[
        [/^\/admin$/,['super_admin','organizer']],
        [/^\/access-center$/,[...adminRoles,'organizer','scorer','vims_operator']],
        [/^\/scorer-admin$/,['super_admin_scorer']], [/^\/vims-admin$/,['super_admin_vims']],
        [new RegExp('^/admin-matches/'+uuid+'$'),[...adminRoles,'organizer']],
        [/^\/(?:create-team|team-dashboard)$/,['team_staff']],
        [/^\/adminscorer$/,['scorer','referee']], [/^\/scorer-offline$/,['scorer']],
        [new RegExp('^/scorer/'+uuid+'$'),['scorer']],
        [new RegExp('^/adminvis(?:/match/'+uuid+')?$'),['vims_operator']],
        [new RegExp('^/staff/'+uuid+'$'),['team_staff']],
    ];
    return rules.some(([pattern,roles])=>pattern.test(path)&&roles.includes(role))?target:null;
}
