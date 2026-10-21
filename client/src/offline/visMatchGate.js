// Memory only: a browser refresh resets the choice, route changes do not.
let current = null;
export function getVisMatchGate(sessionKey) {
    if (!current || current.sessionKey !== sessionKey) current = { sessionKey, serverMatchesLoaded: false };
    return current;
}
