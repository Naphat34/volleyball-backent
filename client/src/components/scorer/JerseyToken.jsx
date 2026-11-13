import { GuardedButton } from '../ui/GuardedAction';
export default function JerseyToken({ children, filled = false, fillColor = '#ffdbb2', outlineColor = '#ffffff', className = '', style, ...props }) {
    return <GuardedButton type="button" {...props} className={className}
        style={{ ...style, background: 'transparent', border: 0, boxShadow: 'none', isolation: 'isolate' }}>
        <svg viewBox="0 0 64 64" aria-hidden="true" className="absolute inset-0 h-full w-full overflow-visible drop-shadow-sm" fill="none">
            <path d="M19 5 26 2 Q32 11 38 2 L45 5 61 17 52 29 47 25 47 61 17 61 17 25 12 29 3 17Z"
                fill={filled ? fillColor : '#ffffff22'} stroke={outlineColor} strokeWidth="2.5"
                strokeLinejoin="round" strokeDasharray={filled ? undefined : '4 3'} />
            <path d="M26 2 Q32 17 38 2" stroke={outlineColor} strokeWidth="2" />
        </svg>
        <span className="absolute inset-0 z-10 flex items-center justify-center pt-2" style={{ fontSize: '.75em' }}>{children}</span>
    </GuardedButton>;
}
