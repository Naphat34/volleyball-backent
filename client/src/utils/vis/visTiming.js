export { projectVisTiming } from '../../offline/visEngine.js';

export function formatVisDuration(seconds, empty = '–:–') {
    if (!Number.isFinite(seconds) || seconds < 0) return empty;
    const value = Math.floor(seconds);
    return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
