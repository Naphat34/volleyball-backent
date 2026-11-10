import useUiTranslation from '../../hooks/useUiTranslation';
import { useId } from 'react';
import { AlertCircle, Inbox, RefreshCw } from 'lucide-react';

export function Button({ children, variant = 'primary', className = '', type = 'button', ...props }) {
    return <button type={type} className={`ui-button ui-button-${variant} ${className}`} {...props}>{children}</button>;
}

export function Panel({ children, title, description, action, className = '' }) {
    const ui = useUiTranslation();
    return <section className={`ui-panel ${className}`}>
        {title && <div className="ui-panel-heading"><div><h2>{ui(title)}</h2>{description && <p>{ui(description)}</p>}</div>{action}</div>}
        {children}
    </section>;
}

export function StatusBadge({ children, tone = 'neutral', dot = false }) {
    return <span className={`ui-badge ui-badge-${tone}`}>{dot && <span className="ui-status-dot" aria-hidden="true" />}{children}</span>;
}

export function Feedback({ title, description, error = false, onRetry, retryLabel = 'ลองใหม่ / Retry' }) {
    const ui = useUiTranslation();
    const Icon = error ? AlertCircle : Inbox;
    return <div className={`ui-feedback ${error ? 'ui-feedback-error' : ''}`} role={error ? 'alert' : 'status'}>
        <Icon size={26} aria-hidden="true" /><div><p className="font-semibold">{ui(title)}</p>{description && <p className="mt-1 text-sm text-slate-500">{ui(description)}</p>}</div>
        {onRetry && <Button variant="secondary" onClick={onRetry}><RefreshCw size={16} />{ui(retryLabel)}</Button>}
    </div>;
}

export function FormField({ label, error, hint, id, ...props }) {
    const ui = useUiTranslation();
    const generatedId = useId();
    const fieldId = id || generatedId;
    return <div className="ui-field"><label htmlFor={fieldId}>{ui(label)}{props.required && <span className="text-rose-600"> *</span>}</label>
        <input id={fieldId} aria-invalid={!!error} aria-describedby={error || hint ? `${fieldId}-help` : undefined} {...props} />
        {(error || hint) && <p id={`${fieldId}-help`} className={error ? 'text-rose-600' : 'text-slate-500'}>{ui(error || hint)}</p>}
    </div>;
}
