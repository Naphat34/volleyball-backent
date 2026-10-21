export async function loadVisMatchList({ fromServer = false, includeServerMatches = false, matchId, offline, readLocal, getRegular, getCustom, getRegularMatch }) {
    if (fromServer && offline) throw Error('ขณะนี้อยู่ในโหมด Offline กรุณากลับโหมดเซิร์ฟเวอร์ก่อนดึงแมตช์');
    let local = [];
    try { local = await readLocal(); } catch (error) { if (offline) throw error; }
    if (offline) return { data: local, serverMatchCount: 0 };
    const include = fromServer || includeServerMatches;
    const direct = !include && /^\d+$/.test(String(matchId || ''));
    const [regular, custom] = await Promise.all([
        include ? getRegular() : direct ? getRegularMatch(matchId).then(row => [row]) : Promise.resolve([]),
        getCustom(),
    ]);
    if (!Array.isArray(regular) || !Array.isArray(custom)) throw Error('รูปแบบรายการแมตช์จากเซิร์ฟเวอร์ไม่ถูกต้อง');
    const activeServers = new Set(local.filter(match => !match.offline_released).map(match => String(match.server_id)));
    return { data: [...regular.filter(match => !activeServers.has(String(match.id))), ...custom.filter(match => !activeServers.has(String(match.id))), ...local],
        serverMatchCount: include ? regular.length : 0 };
}
