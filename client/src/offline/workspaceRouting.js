export function workspacesFor(user) {
    const role = String(user?.role || '').toLowerCase();
    return ['admin', 'statistician'].includes(role) ? ['vis', 'scorer'] : ['score', 'scorer'].includes(role) ? ['scorer'] : [];
}

export function workspaceIntent(search = '') {
    const params = new URLSearchParams(search);
    const target = params.get('returnTo') || '';
    const match = /^(\/adminvis\/match\/([\w-]+)|\/scorer\/(\d+))$/.exec(target);
    const destination = match ? target : null;
    const workspace = destination || ['/adminvis', '/adminscorer', '/scorer-offline'].includes(target) ? (target.startsWith('/adminvis') ? 'vis' : 'scorer') :
        params.get('workspace') || (params.get('scorer-offline') === '1' ? 'scorer' : params.get('vis-sync') === '1' ? 'vis' : null);
    return { workspace: ['vis', 'scorer'].includes(workspace) ? workspace : null, destination };
}

export function workspaceHome(workspace, offline) {
    return workspace === 'vis' ? '/adminvis' : offline ? '/scorer-offline' : '/adminscorer';
}

export function loginSearch(search, workspace) {
    if (!workspace) return search;
    const params = new URLSearchParams(search);
    if (workspaceIntent(search).workspace !== workspace) params.delete('returnTo');
    params.delete('vis-sync');
    params.delete('scorer-offline');
    params.set('workspace', workspace);
    return `?${params}`;
}

export function loginPath(pathname) {
    if (/^\/adminvis(?:\/|$)/.test(pathname)) return '/vis/login';
    if (/^\/(?:adminscorer|scorer-offline|scorer)(?:\/|$)/.test(pathname)) return '/scorer/login';
    return '/login';
}

export function canEnterWorkspace(user, workspace, offline) {
    return workspacesFor(user).includes(workspace) || (!offline && workspace === 'scorer' && user?.role === 'referee');
}

