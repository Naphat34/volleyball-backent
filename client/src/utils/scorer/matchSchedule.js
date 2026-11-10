const zone = 'Asia/Bangkok';
function timestampParts(value) {
    if (!value) return null;
    const raw = String(value).trim();
    // SQL DATETIME without a zone is a Bangkok wall time, not browser local time.
    const local = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/);
    if (local) return { day: local[1], time: local[2] };
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
    const get = type => parts.find(part => part.type === type)?.value;
    return { day: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}
export function matchSchedule(match = {}) {
    const dateValue = match.match_date;
    const dayOnly = typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue) ? dateValue : '';
    const rawTime = match.start_time || match.raw_start_time;
    const wallTime = typeof rawTime === 'string' ? rawTime.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/) : null;
    const instant = wallTime ? null : timestampParts(rawTime);
    const dateParts = dayOnly ? null : timestampParts(dateValue);
    const time = wallTime && Number(wallTime[1]) < 24 && Number(wallTime[2]) < 60
        ? `${wallTime[1].padStart(2, '0')}:${wallTime[2]}` : instant?.time || '';
    return { day: dayOnly || dateParts?.day || instant?.day || '', time };
}
export function matchScheduleSortKey(match) {
    const { day, time } = matchSchedule(match);
    return `${day || '9999-12-31'}T${time || '99:99'}`;
}
export function matchScheduleDate(match, th = false) {
    const { day } = matchSchedule(match);
    if (!day) return '—';
    return new Date(`${day}T12:00:00+07:00`).toLocaleDateString(th ? 'th-TH' : 'en-GB', {
        timeZone: zone, day: '2-digit', month: '2-digit', year: '2-digit' });
}
