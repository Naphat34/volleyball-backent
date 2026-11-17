const db = require('../config/db');
const { uuidPattern } = require('../middleware/publicId');
const { tables } = require('../middleware/publicUrl');
const auth = require('../middleware/authMiddleware');

// This endpoint exchanges references in JSON bodies only. Resource data and every
// mutation remain behind their existing authorization checks after URL resolution.
exports.resolve = async (req, res) => {
    try {
        const references = req.body?.references;
        if (!Array.isArray(references) || !references.length || references.length > 100) return res.status(400).json({ error: 'Provide 1–100 identifier references' });
        if (references.some(ref => !ref || !tables.has(ref.entity === 'matchRecords' ? 'matches' : ref.entity)
            || typeof ref.value !== 'string' || !(/^[1-9]\d*$/.test(ref.value) || uuidPattern.test(ref.value) || /^custom-[0-9a-f-]{36}$/i.test(ref.value)))) return res.status(400).json({ error: 'Invalid identifier reference' });
        if (req.headers.authorization || req.cookies?.token) {
            let authenticated = false;
            let tokenValid = false;
            auth.verifyToken(req, res, () => { tokenValid = true; });
            if (!tokenValid) return;
            await auth.requireApprovedUser(req, res, () => { authenticated = true; });
            if (!authenticated) return;
        }
        const result = [];
        for (const ref of references) {
            const entity = ref.entity === 'matchRecords' ? 'matches' : ref.entity;
            const byPublic = uuidPattern.test(ref.value);
            let table = ref.value.startsWith('custom-') && ref.entity === 'matchRecords' ? 'custom_vis_matches' : entity;
            const columns = table => 'id, public_id' + ({ matches:', manual_owner_id, competition_id', custom_vis_matches:', owner_id, competition_id', teams:', manual_owner_id', players:', team_id' }[table] || '');
            let rows = (await db.query(`SELECT ${columns(table)} FROM ${table} WHERE ${byPublic ? 'public_id' : 'id'} = ?`, [ref.value])).rows;
            if (!rows.length && ref.entity === 'matchRecords') {
                table = 'custom_vis_matches';
                rows = (await db.query(`SELECT ${columns(table)} FROM ${table} WHERE ${byPublic ? 'public_id' : 'id'} = ?`, [ref.value])).rows;
            }
            const row = rows[0];
            if (!row) return res.status(404).json({ error: 'Identifier not found' });
            const publicTables = ['competitions','teams','players','matches','team_staff'];
            let privateRecord = !publicTables.includes(table) || Boolean(row.manual_owner_id);
            if (table === 'players') {
                const team = (await db.query('SELECT manual_owner_id FROM teams WHERE id=?', [row.team_id])).rows[0];
                privateRecord ||= Boolean(team?.manual_owner_id);
            }
            if (privateRecord && !req.user) return res.status(401).json({ error: 'Sign in to resolve this identifier' });
            if (table === 'custom_vis_matches' || (table === 'matches' && row.manual_owner_id)) {
                const owner = row.owner_id || row.manual_owner_id;
                if (String(owner) !== String(req.user?.id) && req.user?.role !== 'super_admin') await require('../utils/accessScope').assertCompetition(db,req.user,row.competition_id);
            }
            result.push({ entity: ref.entity, id: String(row.id), public_id: row.public_id });
        }
        res.set('Cache-Control', 'no-store');
        res.json({ references: result });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.status ? error.message : 'Unable to resolve identifiers' });
    }
};
