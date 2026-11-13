const { playerNameFields } = require('./bilingualNames');
const flag = value => value === true || value === 'true' || value === 1 || value === '1';
const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };

// Master defaults and competition-specific roster values have separate lifetimes.
function normalizeAthleteRoles(patch, current = {}) {
    const result = { ...patch };
    if (!['position', 'is_libero1', 'is_libero2'].some(key => patch[key] !== undefined)) return result;
    const position = patch.position === undefined ? current.position : patch.position;
    if (position != null && position !== '' && !['S', 'OH', 'OPP', 'MB', 'L'].includes(position)) fail('ตำแหน่งนักกีฬาไม่ถูกต้อง');
    let l1 = flag(patch.is_libero1 === undefined ? current.is_libero1 : patch.is_libero1);
    let l2 = flag(patch.is_libero2 === undefined ? current.is_libero2 : patch.is_libero2);
    if (position !== 'L') {
        if (flag(patch.is_libero1) || flag(patch.is_libero2)) fail('ผู้เล่น Libero ต้องมีตำแหน่ง L');
        l1 = false; l2 = false;
    }
    if (l1 && l2) fail('นักกีฬาหนึ่งคนเป็น L1 และ L2 พร้อมกันไม่ได้');
    return { ...result, position: position || null, is_libero1: l1, is_libero2: l2 };
}

function athleteError(error) {
    if (error.code === 'ER_DUP_ENTRY' && String(error.message).includes('uq_players_team_active_number')) return { status: 409, message: 'หมายเลขเสื้อนี้มีนักกีฬาในทีมใช้งานแล้ว กรุณาเลือกหมายเลขอื่น / Jersey number is already used by this team' };
    if (error.code === 'ER_DUP_ENTRY') return { status: 409, message: 'เบอร์นักกีฬา บทบาทกัปตัน/Libero หรือเลขประจำตัวซ้ำ กรุณาตรวจสอบข้อมูล' };
    if (['ER_CHECK_CONSTRAINT_VIOLATED', 'ER_SIGNAL_EXCEPTION'].includes(error.code)) return { status: 400, message: 'ข้อมูลนักกีฬาหรือบทบาทไม่สอดคล้องกัน' };
    if (error.code === 'ER_ROW_IS_REFERENCED_2') return { status: 409, message: 'มีประวัติอ้างอิงนักกีฬา กรุณาปิดใช้งานแทนการลบ' };
    return { status: error.status || 500, message: error.status ? error.message : 'ไม่สามารถบันทึกข้อมูลนักกีฬาได้' };
}

async function validateTeamPlayerNumber(connection, teamId, rawNumber, playerId = null) {
    const number = Number(rawNumber);
    if (!/^[0-9]+$/.test(String(rawNumber).trim()) || !Number.isInteger(number) || number < 1 || number > 999) {
        fail('หมายเลขเสื้อต้องเป็นจำนวนเต็ม 1–999 / Jersey number must be an integer from 1 to 999');
    }
    const duplicate = await connection.query(require('./sqlDialect').sqlDialect(`SELECT id FROM players
        WHERE team_id=? AND number=? AND COALESCE(is_active,1)=1 AND (? IS NULL OR id<>?) LIMIT 1`, `SELECT id FROM players
        WHERE team_id=? AND number=? AND COALESCE(is_active,1)=1 AND (CAST(? AS integer) IS NULL OR id<>?) LIMIT 1`),
    [teamId,number,playerId,playerId]);
    if (duplicate.rows.length) throw Object.assign(new Error('หมายเลขเสื้อนี้มีนักกีฬาในทีมใช้งานแล้ว กรุณาเลือกหมายเลขอื่น / Jersey number is already used by this team'), { status: 409 });
}

function withAthleteTransaction(database, handler, { syncRoster = false } = {}) {
    return async (req, res) => {
        let connection, code = 200, method, payload;
        const reply = { status(value) { code = value; return this; }, json(value) { method = 'json'; payload = value; }, send(value) { method = 'send'; payload = value; } };
        try {
            connection = await database.connect();
            await connection.beginTransaction();
            let rosterTeamId;
            if (syncRoster) {
                if (syncRoster === 'admin') {
                    rosterTeamId = req.params.teamId;
                    if (!rosterTeamId && req.params.id) {
                        const player = await connection.query('SELECT team_id FROM players WHERE id=?', [req.params.id]);
                        rosterTeamId = player.rows[0]?.team_id;
                    }
                } else {
                    const user = await connection.query('SELECT team_id FROM users WHERE id=?', [req.user.id]);
                    rosterTeamId = user.rows[0]?.team_id;
                }
                await require('./automaticEntryRoster').syncTeamEntries(connection, rosterTeamId);
                if (rosterTeamId && req.body?.number !== undefined) await validateTeamPlayerNumber(connection, rosterTeamId, req.body.number, req.params?.id ?? null);
            }
            await handler(req, reply, connection);
            if (!method) throw Error('Athlete handler did not produce a response');
            if (code < 400) {
                const names = playerNameFields.filter(field => req.body?.[field] !== undefined);
                if (names.length && payload?.id) {
                    await connection.query('UPDATE players SET ' + names.map(field => field + '=?').join(',') + ' WHERE id=?', [...names.map(field => req.body[field]), payload.id]);
                    payload = {...payload,...Object.fromEntries(names.map(field => [field,req.body[field]]))};
                }
                if (syncRoster) await require('./automaticEntryRoster').syncTeamEntries(connection, rosterTeamId);
                await connection.commit();
            }
            else await connection.rollback();
            return res.status(code)[method](payload);
        } catch (error) {
            if (connection) await connection.rollback();
            const failure = athleteError(error);
            return res.status(failure.status).json({ error: failure.message });
        } finally { connection?.release(); }
    };
}

module.exports = { normalizeAthleteRoles, athleteError, flag, withAthleteTransaction, validateTeamPlayerNumber };
