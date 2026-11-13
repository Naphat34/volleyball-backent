import { createContext, forwardRef, useContext, useEffect, useRef, useState } from 'react';
import { createActionLock } from '../../utils/common/actionLock';

const FormBusy = createContext(false);
function useActionLock() {
    const lock = useRef(createActionLock());
    const mounted = useRef(true);
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);
    const run = async (event, action, showBusy = true) => {
        if (lock.current.busy) { event.preventDefault(); event.stopPropagation(); return; }
        if (showBusy) setBusy(true);
        try { await lock.current.run(() => action?.(event)); }
        finally { if (mounted.current && showBusy) setBusy(false); }
    };
    return { busy, run };
}

export const GuardedButton = forwardRef(function GuardedButton({ onClick, disabled, children, ...props }, ref) {
    const formBusy = useContext(FormBusy);
    const { busy, run } = useActionLock();
    return <button {...props} ref={ref} disabled={disabled || busy || formBusy}
        aria-busy={busy || formBusy || props['aria-busy'] || undefined}
        onClick={event => {
            // A native submit must reach the form before its button becomes disabled.
            const nativeFormAction = ['submit', 'reset'].includes(event.currentTarget.type) && Boolean(event.currentTarget.form);
            return run(event, onClick, !nativeFormAction);
        }}>{children}</button>;
});

export const GuardedForm = forwardRef(function GuardedForm({ onSubmit, children, ...props }, ref) {
    const { busy, run } = useActionLock();
    return <FormBusy.Provider value={busy}><form {...props} ref={ref} aria-busy={busy || props['aria-busy'] || undefined}
        onSubmit={event => {
            if (onSubmit) event.preventDefault();
            return run(event, onSubmit);
        }}>{children}</form></FormBusy.Provider>;
});
