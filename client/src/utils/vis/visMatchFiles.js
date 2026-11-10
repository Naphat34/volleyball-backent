import { api } from '../../api';
import { buildSeavaExport } from './seavaExport';
export function validateVisFile(value) {
    if (!value || !['volley-vis', 'seava-vis'].includes(value.format) || value.version !== 1 || !value.backup?.config || !Array.isArray(value.backup.actions)) {
        throw new Error('รองรับไฟล์ JSON หรือ .seava ที่ส่งออกจาก VOLLEY VIMS และมีข้อมูลสำรองครบถ้วนเท่านั้น');
    }
    return value;
}
export async function exportVisMatch(match, options = {}) {
    const [response, roster] = await Promise.all([api.getVisState(match.id), api.getMatchRosterData(match.id)]);
    const value = buildSeavaExport(match, roster.data, response.data, options);
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = Array.from(value.match.config.title, char => char.charCodeAt(0) < 32 ? '_' : char).join('').replace(/[<>:"/\\|?*]/g, '_') + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
