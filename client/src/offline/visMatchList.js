export async function loadVisMatchList({ fromServer = false, includeServerMatches = false, matchId, offline, readLocal, getRegular, getCustom, getRegularMatch, getManual = async () => [] }) {
    if (fromServer && offline) throw Error('ขณะนี้อยู่ในโหมด Offline กรุณากลับโหมดเซิร์ฟเวอร์ก่อนดึงแมตช์');
    let local = [];
    try { local = await readLocal(); } catch (error) { if (offline) throw error; }
    if (offline) return { data: local, serverMatchCount: 0 };
    const include = fromServer || includeServerMatches;
    const direct = !include && /^\d+$/.test(String(matchId || ''));
    const [regular, custom, manual] = await Promise.all([
        include ? getRegular() : direct ? getRegularMatch(matchId).then(row => [row]) : Promise.resolve([]),
        getCustom(),
        include ? getManual() : Promise.resolve([]),
    ]);
    if (![regular, custom, manual].every(Array.isArray)) throw Error('รูปแบบรายการแมตช์จากเซิร์ฟเวอร์ไม่ถูกต้อง');
    const server = [...new Map([...regular, ...manual].map(match => [String(match.id), match])).values()];
    const activeServers = new Set(local.filter(match => !match.offline_released).map(match => String(match.server_id)));
    return { data: [...server.filter(match => !activeServers.has(String(match.id))), ...custom.filter(match => !activeServers.has(String(match.id))), ...local],
        serverMatchCount: include ? server.length : 0 };
}
