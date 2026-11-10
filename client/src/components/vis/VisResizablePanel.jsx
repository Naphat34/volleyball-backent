import useUiTranslation from '../../hooks/useUiTranslation';
import useVisTranslation from './useVisTranslation';
import { useRef } from 'react';

export default function VisResizablePanel({ id, title, weight, orientation, onResize, children }) {
    const ui = useUiTranslation();
    const vt = useVisTranslation();
    const panel = useRef(null);
    const drag = useRef(null);
    const vertical = orientation === 'column';
    const start = (event, edge) => {
        if (event.button !== 0) return;
        const panels = [...panel.current.parentElement.children].filter(element => element.dataset.panel);
        const index = panels.indexOf(panel.current);
        const neighbor = panels[index + (edge === 'start' ? -1 : 1)];
        if (!neighbor) return;
        const sizes = Object.fromEntries(panels.map(element => [element.dataset.panel, vertical ? element.getBoundingClientRect().height : element.getBoundingClientRect().width]));
        drag.current = { neighbor: neighbor.dataset.panel, sizes, origin: vertical ? event.clientY : event.clientX, direction: edge === 'start' ? -1 : 1 };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
    };
    const move = event => {
        if (!drag.current) return;
        const { neighbor, sizes, origin, direction } = drag.current;
        const total = sizes[id] + sizes[neighbor];
        const minimum = Math.min(vertical ? 160 : 180, total / 2);
        const size = Math.max(minimum, Math.min(total - minimum, sizes[id] + ((vertical ? event.clientY : event.clientX) - origin) * direction));
        const next = { ...sizes, [id]: size, [neighbor]: total - size };
        const available = Object.values(next).reduce((sum, value) => sum + value, 0);
        onResize(Object.fromEntries(Object.entries(next).map(([key, value]) => [key, value / available * 100])));
    };
    const stop = event => {
        drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    };
    return <section ref={panel} data-panel={id} className="vis-resizable-panel" style={{ flex: `${weight} 1 0%` }} aria-label={ui(title)}>
        <div className="vis-resizable-content">{children}</div>
        {['start', 'end'].map(edge => <div key={edge} className={'vis-panel-edge vis-panel-edge-' + edge} title={vt("ลากเพื่อปรับขนาดแผง")} onPointerDown={event => start(event, edge)} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={() => { drag.current = null; }} />)}
    </section>;
}
