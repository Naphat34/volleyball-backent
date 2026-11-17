// Single source of truth; database catalogs and client capabilities derive from this registry.
const roleAliases = { admin: 'super_admin', score: 'scorer', statistician: 'vims_operator' };
const normalizeRole = role => typeof role==='string'?(Object.hasOwn(roleAliases,role)?roleAliases[role]:role):undefined;
const permissionsByRole = {
    super_admin: ['admin.manage', 'identity.manage', 'system.manage', 'socket.monitor', 'audit.read', 'competition.manage', 'registration.manage', 'team.manage', 'team.read', 'match.manage', 'match.view', 'official.manage', 'official.view', 'report.export', 'score.monitor', 'vims.monitor', 'athlete.identity.link'],
    super_admin_scorer: ['identity.domain.manage', 'score.monitor', 'score.review', 'score.publish', 'score.reopen', 'match.view', 'official.view', 'report.export'],
    super_admin_vims: ['identity.domain.manage', 'vims.monitor', 'vims.review', 'vims.publish', 'vims.reopen', 'match.view', 'official.view', 'report.export'],
    organizer: ['competition.manage', 'team.read', 'registration.manage', 'match.manage', 'match.view', 'official.view', 'report.export'],
    scorer: ['match.score', 'score.record', 'score.submit', 'score.offline', 'match.view', 'official.view'],
    vims_operator: ['vims.record', 'vims.submit', 'vims.offline', 'match.view', 'official.view'],
    referee: ['match.view', 'official.view'],
    team_staff: ['team.self.manage', 'match.request', 'match.view'],
};
const administratorRoles = new Set(['super_admin', 'super_admin_scorer', 'super_admin_vims']);
const getRolePermissions = role => Object.hasOwn(permissionsByRole,normalizeRole(role))?[...permissionsByRole[normalizeRole(role)]]:[];
function roleHasPermission(role, permission) {
    const canonical = normalizeRole(role);
    if (administratorRoles.has(canonical) && ['match.score', 'score.record', 'score.submit', 'score.offline', 'vims.record', 'vims.submit', 'vims.offline'].includes(permission)) return false;
    return getRolePermissions(canonical).includes(permission);
}
module.exports = { normalizeRole, permissionsByRole, getRolePermissions, roleHasPermission, administratorRoles };
