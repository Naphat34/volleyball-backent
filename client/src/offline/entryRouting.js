import { normalizeAccountRole } from '../auth/roles.js';
export function canEnterSection(user, section, offline = false) {
    const role = normalizeAccountRole(user?.role);
    if (section === 'vis') return ['vims_operator'].includes(role);
    if (section === 'scorer') return ['scorer'].includes(role) || (!offline && role === 'referee');
    return false;
}

export function loginIntent(search = '') {
    const params = new URLSearchParams(search);
    const target = params.get('returnTo') || '';
    const uuid = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}';
    const destination = new RegExp(`^(/adminvis/match/${uuid}|/scorer/${uuid})$`).test(target) ? target : null;
    const section = destination || ['/adminvis', '/adminscorer', '/scorer-offline'].includes(target) ? (target.startsWith('/adminvis') ? 'vis' : 'scorer') :
        params.get('scorer-offline') === '1' ? 'scorer' : params.get('vis-sync') === '1' ? 'vis' : null;
    return { section, destination };
}

export function sectionHome(section, offline) {
    return section === 'vis' ? '/adminvis' : offline ? '/scorer-offline' : '/adminscorer';
}

export function roleHome(user, offline = false) {
    const role=normalizeAccountRole(user.role);
    if (role === 'super_admin') return '/admin';
    if (role==='super_admin_scorer') return '/scorer-admin';
    if (role==='super_admin_vims') return '/vims-admin';
    if (role==='organizer') return '/access-center';
    if (role === 'vims_operator') return '/adminvis';
    if (['scorer', 'referee'].includes(role)) return sectionHome('scorer', offline);
    return user.team_id ? '/team-dashboard' : '/create-team';
}

