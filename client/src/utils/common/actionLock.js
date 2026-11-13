export function createActionLock() {
    let locked = false;
    return {
        get busy() { return locked; },
        async run(action, minimumMs = 300) {
            if (locked) return;
            locked = true;
            const started = Date.now();
            try { return await action(); }
            finally {
                const remaining = minimumMs - (Date.now() - started);
                if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
                locked = false;
            }
        },
    };
}
