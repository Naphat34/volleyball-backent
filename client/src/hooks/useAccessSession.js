import { useEffect, useState } from 'react';
import { getAccessSession } from '../authStorage';

export default function useAccessSession() {
    const [, refresh] = useState(0);
    useEffect(() => {
        const update = () => refresh(value => value + 1);
        const interval = setInterval(update, 15000);
        window.addEventListener('storage', update);
        window.addEventListener('focus', update);
        return () => { clearInterval(interval); window.removeEventListener('storage', update); window.removeEventListener('focus', update); };
    }, []);
    return getAccessSession();
}
