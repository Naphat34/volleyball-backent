export function canEnterSection(user, section, offline = false) {
    const role = user?.role;
    if (section === 'vis') return ['admin', 'statistician'].includes(role);
    if (section === 'scorer') return ['admin', 'statistician', 'score', 'scorer'].includes(role) || (!offline && role === 'referee');
    return false;
}

export function loginIntent(search = '') {
    const params = new URLSearchParams(search);
    const target = params.get('returnTo') || '';
    const destination = /^(\/adminvis\/match\/[\w-]+|\/scorer\/\d+)$/.test(target) ? target : null;
    const section = destination || ['/adminvis', '/adminscorer', '/scorer-offline'].includes(target) ? (target.startsWith('/adminvis') ? 'vis' : 'scorer') :
        params.get('scorer-offline') === '1' ? 'scorer' : params.get('vis-sync') === '1' ? 'vis' : null;
    return { section, destination };
}

export function sectionHome(section, offline) {
    return section === 'vis' ? '/adminvis' : offline ? '/scorer-offline' : '/adminscorer';
}

export function roleHome(user, offline = false) {
    if (user.role === 'admin') return offline ? '/adminvis' : '/admin';
    if (user.role === 'statistician') return '/adminvis';
    if (['score', 'scorer', 'referee'].includes(user.role)) return sectionHome('scorer', offline);
    return user.team_id ? '/team-dashboard' : '/create-team';
}

