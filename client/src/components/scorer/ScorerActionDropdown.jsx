import useUiTranslation from '../../hooks/useUiTranslation';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './ScorerActionDropdown.css';

export default function ScorerActionDropdown({ label, children }) {
    const ui = useUiTranslation();
    const [open, setOpen] = useState(false);
    const trigger = useRef(null), panel = useRef(null);
    const id = useId();
    useLayoutEffect(() => {
        if (!open) return;
        const anchor = trigger.current.getBoundingClientRect();
        const menu = panel.current;
        const bounds = menu.getBoundingClientRect();
        const below = window.innerHeight - anchor.bottom - 16;
        const above = anchor.top - 16;
        const downward = below >= bounds.height || below >= above;
        menu.style.maxHeight = `${Math.max(0, downward ? below : above)}px`;
        menu.style.left = `${Math.max(8, Math.min(anchor.right - bounds.width, window.innerWidth - bounds.width - 8))}px`;
        menu.style.top = `${downward ? anchor.bottom + 6 : Math.max(8, anchor.top - Math.min(bounds.height, above) - 6)}px`;
        menu.querySelector('button:not(:disabled),a[href]')?.focus();
    }, [open]);
    useEffect(() => {
        if (!open) return;
        const outside = event => {
            if (!trigger.current?.contains(event.target) && !panel.current?.contains(event.target)) setOpen(false);
        };
        const close = event => {
            if (event.type === 'scroll' && panel.current?.contains(event.target)) return;
            setOpen(false);
        };
        const escape = event => {
            if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
        };
        document.addEventListener('pointerdown', outside);
        document.addEventListener('keydown', escape);
        window.addEventListener('resize', close);
        window.addEventListener('scroll', close, true);
        return () => {
            document.removeEventListener('pointerdown', outside);
            document.removeEventListener('keydown', escape);
            window.removeEventListener('resize', close);
            window.removeEventListener('scroll', close, true);
        };
    }, [open]);
    const navigate = event => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        const items = [...panel.current.querySelectorAll('button:not(:disabled),a[href]')];
        if (!items.length) return;
        event.preventDefault();
        const index = items.indexOf(document.activeElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[next].focus();
    };
    return <>
        <button ref={trigger} type="button" aria-label={ui(label)} aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(value => !value)} onKeyDown={event => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); }
        }}>⋯</button>
        {open && createPortal(<div ref={panel} id={id} className="scorer-action-menu" role="region" aria-label={ui(label)} onKeyDown={navigate} onBlur={event => {
            if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget) && !trigger.current?.contains(event.relatedTarget)) setOpen(false);
        }} onClick={event => {
            if (event.target.closest('button:not(:disabled),a[href]')) { setOpen(false); trigger.current?.focus(); }
        }}>{children}</div>, document.body)}
    </>;
}
