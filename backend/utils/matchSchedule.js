const parts = value => {
    if (!value) return {};
    if (typeof value === 'string') {
        const wall = value.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?)?$/);
        if (wall) return { day: wall[1], time: wall[2] };
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return {};
    const values = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
    const get = type => values.find(part => part.type === type)?.value;
    return { day: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
};
function normalizeMatchSchedule(match) {
    const raw = match.raw_start_time ?? match.start_time;
    const timeOnly = typeof raw === 'string' && /^(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(raw);
    const start = timeOnly ? {} : parts(raw);
    const date = parts(match.match_date);
    const { raw_start_time, ...rest } = match;
    return { ...rest, match_date: date.day || start.day || null,
        start_time: timeOnly ? raw.split(':').slice(0, 2).map(part => part.padStart(2, '0')).join(':') : start.time || null };
}
module.exports = { normalizeMatchSchedule };
