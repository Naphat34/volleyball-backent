const fail = message => { const error = new Error(message); error.status = 400; throw error; };
const text = (value, max, label, required = false) => {
    if (value != null && typeof value !== 'string') fail(`${label}: รูปแบบไม่ถูกต้อง`);
    const result = (value || '').trim();
    if ((required && !result) || result.length > max) fail(`${label}: กรุณาระบุข้อมูลไม่เกิน ${max} ตัวอักษร`);
    return result;
};
function integer(value, min, max, label) {
    const n = Number(value);
    if (value === '' || value == null || !Number.isInteger(n) || n < min || n > max) fail(`${label}: ต้องเป็นจำนวนเต็ม ${min}–${max}`);
    return n;
}
function normalizeManualMatch(body = {}) {
    const config = {
        title: text(body.title, 160, 'ชื่อรายการ'),
        date: text(body.date, 10, 'วันที่'), time: text(body.time, 5, 'เวลา'),
        location: text(body.location, 100, 'สนาม'),
        matchNumber: body.matchNumber === '' || body.matchNumber == null ? null : integer(body.matchNumber, 1, 999999, 'หมายเลขแมตช์'),
        maxSets: integer(body.maxSets ?? 5, 3, 5, 'จำนวนเซต'),
        pointsPerSet: integer(body.pointsPerSet ?? 25, 5, 99, 'คะแนนต่อเซต'),
        decidingSetPoints: integer(body.decidingSetPoints ?? 15, 5, 99, 'คะแนนเซตตัดสิน'),
        hasChallenge: body.hasChallenge === true,
        gender: text(body.gender, 10, 'ประเภท'),
    };
    if (![3, 5].includes(config.maxSets)) fail('เลือกจำนวนเซต 3 หรือ 5');
    if (!['', 'Male', 'Female', 'Mixed'].includes(config.gender)) fail('ประเภทไม่ถูกต้อง');
    if (config.date && (!/^\d{4}-\d{2}-\d{2}$/.test(config.date) || Number.isNaN(Date.parse(config.date)) || new Date(`${config.date}T00:00:00Z`).toISOString().slice(0, 10) !== config.date)) fail('วันที่ไม่ถูกต้อง');
    if (config.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(config.time)) fail('เวลาไม่ถูกต้อง');
    for (const side of ['home', 'away']) {
        const team = body[side] || {};
        if (!Array.isArray(team.players) || team.players.length > 30) fail('รายชื่อทีมต้องเป็นรายการไม่เกิน 30 คน');
        const numbers = new Set();
        const players = team.players.map(p => {
            const number = integer(p.number, 1, 999, 'หมายเลขเสื้อ');
            if (numbers.has(number)) fail('หมายเลขเสื้อซ้ำในทีมเดียวกัน');
            numbers.add(number);
            const position = text(p.position, 3, 'ตำแหน่ง');
            if (!['', 'S', 'OH', 'MB', 'OPP', 'L'].includes(position)) fail('ตำแหน่งไม่ถูกต้อง');
            return { number, first_name: text(p.first_name, 50, 'ชื่อ', true), last_name: text(p.last_name, 50, 'นามสกุล'), position, is_captain: p.is_captain === true };
        });
        if (players.filter(p => p.is_captain).length > 1) fail('กำหนดกัปตันได้ทีมละหนึ่งคน');
        if (players.filter(p => p.position === 'L').length > 2) fail('กำหนด Libero ได้ทีมละไม่เกินสองคน');
        const color = text(team.color || (side === 'home' ? '#2563eb' : '#dc2626'), 7, 'สีเสื้อ');
        if (!/^#[0-9a-f]{6}$/i.test(color)) fail('สีเสื้อไม่ถูกต้อง');
        config[side] = { name: text(team.name, 100, 'ชื่อทีม', true), color, players };
    }
    if (config.home.name === config.away.name) fail('ชื่อทีมทั้งสองต้องต่างกัน');
    return config;
}
function assertReady(config) {
    for (const side of ['home', 'away']) {
        const players = config[side].players;
        if (players.filter(p => p.position !== 'L').length < 6) fail('ต้องมีผู้เล่นทั่วไปทีมละอย่างน้อย 6 คนก่อนเปิดบันทึกคะแนน');
        if (players.filter(p => p.is_captain).length !== 1) fail('กรุณากำหนดกัปตันทีมละหนึ่งคนก่อนเริ่ม');
    }
}
const parseConfig = value => typeof value === 'string' ? JSON.parse(value) : value;
const canManage = (user, match) => Boolean(user && (user.role === 'admin' || String(user.id) === String(match.manual_owner_id)));
module.exports = { normalizeManualMatch, assertReady, parseConfig, canManage };
