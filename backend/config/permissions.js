const roleAliases = {
  score: 'scorer',
};

const permissionsByRole = {
  admin: ['*'],
  organizer: [
    'competition.manage',
    'team.manage',
    'match.manage',
    'report.export',
    'official.manage',
    'socket.monitor',
  ],
  scorer: [
    'match.score',
    'match.view',
    'official.view',
  ],
  team_staff: [
    'team.self.manage',
    'match.request',
    'match.view',
  ],
};

const normalizeRole = (role) => roleAliases[role] || role;

const getRolePermissions = (role) => permissionsByRole[normalizeRole(role)] || [];

const roleHasPermission = (role, permission) => {
  const permissions = getRolePermissions(role);
  return permissions.includes('*') || permissions.includes(permission);
};

module.exports = {
  getRolePermissions,
  normalizeRole,
  permissionsByRole,
  roleHasPermission,
};
