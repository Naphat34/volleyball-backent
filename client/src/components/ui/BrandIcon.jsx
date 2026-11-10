import { siGooglemaps, siYoutube } from 'simple-icons';

const brands = { googleMaps: siGooglemaps, youtube: siYoutube };

// Bundle the selected brand paths so logos also work without a network connection.
export default function BrandIcon({ brand, size = 18, title, className = '' }) {
    const icon = brands[brand];
    if (!icon) return null;

    return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
        className={`inline-block shrink-0 align-middle ${className}`}
        role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
        <path d={icon.path} />
    </svg>;
}
