import { useLocation } from 'react-router-dom';
import useAccessSession from '../../hooks/useAccessSession';

export default function AccessStatus() {
    const { state } = useLocation();
    const session = useAccessSession();
    const notice = state?.accessNotice || (session.readOnly ? session.reason : '');
    if (!notice) return null;

    return <aside className="mb-4 rounded-lg border border-slate-500 bg-slate-900 p-3 text-sm text-slate-100">
        <p role="status" className="text-amber-200">{notice}</p>
    </aside>;
}
