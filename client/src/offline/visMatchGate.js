// Keep the explicit server-list choice across refreshes in the current browser tab.
const storageKey = 'volley-vis-match-list';
let current = null;
const removeSavedChoice = () => { try { globalThis.sessionStorage?.removeItem(storageKey); } catch { /* Storage may be unavailable. */ } };
export function clearVisMatchGate() { current = null; removeSavedChoice(); }
export function getVisMatchGate(sessionKey) {
    if (!current || current.sessionKey !== sessionKey) {
        const owner = String(sessionKey).split(':')[0];
        let loaded = false;
        if (!current) {
            try {
                const saved = JSON.parse(globalThis.sessionStorage?.getItem(storageKey) || 'null');
                loaded = saved?.owner === owner && saved.loaded === true;
            } catch { /* Malformed or blocked storage starts with the normal initial view. */ }
        } else removeSavedChoice();
        current = {
            sessionKey,
            get serverMatchesLoaded() { return loaded; },
            set serverMatchesLoaded(value) {
                loaded = value === true;
                try { globalThis.sessionStorage?.setItem(storageKey, JSON.stringify({ owner, loaded })); } catch { /* Keep the choice for this page. */ }
            }
        };
    }
    return current;
}
