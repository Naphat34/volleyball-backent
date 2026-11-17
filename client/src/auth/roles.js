export const normalizeAccountRole = role => ({admin:'super_admin',score:'scorer',statistician:'vims_operator'}[role]||role);
export const normalizeAccount = user => user?{...user,role:normalizeAccountRole(user.role)}:user;
