import { useEffect, useState } from 'react';
import { publicUrl } from '../../utils/navigation/publicUrls.js';

// Native links retain copy-link, new-tab and modifier-click behavior with UUIDs.
export default function PublicAnchor({ href, children, ...props }) {
    const [resolved, setResolved] = useState({ source: null, href: undefined });
    useEffect(() => {
        let active = true;
        void publicUrl(href).then(value => { if (active) setResolved({ source: href, href: value }); }).catch(() => { if (active) setResolved({ source: href, href: undefined }); });
        return () => { active = false; };
    }, [href]);
    return <a {...props} href={resolved.source === href ? resolved.href : undefined}>{children}</a>;
}
