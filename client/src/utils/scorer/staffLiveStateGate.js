// Prevent delayed polling responses from overwriting newer socket snapshots.
export function createStaffLiveStateGate() {
    let request = 0;
    let revision = 0;
    let updatedAt = 0;
    const current = token => token.request === request && token.revision === revision;
    return {
        begin: () => ({ request: ++request, revision }),
        current,
        currentRequest: token => token.request === request,
        accept(snapshot, token) {
            if (token && !current(token)) return false;
            const timestamp = Number(snapshot?.updatedAt) || Date.parse(snapshot?.serverUpdatedAt) || 0;
            if (updatedAt && (!timestamp || timestamp < updatedAt)) return false;
            updatedAt = timestamp || updatedAt;
            if (!token) revision += 1;
            return true;
        },
    };
}
