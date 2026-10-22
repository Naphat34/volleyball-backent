// Remember an explicit fetch across route changes, reset on refresh or login.
let current = null;
export function getScorerMatchGate(sessionKey) {
    if (!current || current.sessionKey !== sessionKey) current = { sessionKey, serverMatchesLoaded: false };
    return current;
}
