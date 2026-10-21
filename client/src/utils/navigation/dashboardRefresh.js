// Serialize refreshes so a slow request cannot overlap a newer dashboard read.
export function dashboardRefresh(load, { enabled = true, target = window, page = document, intervalMs = 5000, onError = error => console.error(error) } = {}) {
    let stopped = false, running = false, pending = false;
    const refresh = async (silent = true) => {
        if (stopped || (silent && page.hidden)) return;
        if (running) { pending = true; return; }
        running = true;
        try { await load(silent); } catch (error) { onError(error); }
        finally {
            running = false;
            if (pending && !stopped) { pending = false; void refresh(); }
        }
    };
    const changed = () => { void refresh(); };
    const events = ['focus', 'online', 'vis-local-updated', 'scorer-offline-updated'];
    const timer = enabled ? setInterval(changed, intervalMs) : null;
    if (enabled) { events.forEach(event => target.addEventListener(event, changed)); page.addEventListener('visibilitychange', changed); }
    return { refresh, stop() {
        stopped = true;
        if (timer != null) clearInterval(timer);
        if (enabled) { events.forEach(event => target.removeEventListener(event, changed)); page.removeEventListener('visibilitychange', changed); }
    } };
}
