const schema = require('../config/publicIdRoutes.json');
const { uuidPattern } = require('./publicId');
const { accessPath } = require('../utils/accessPath');

const tables = new Set(['matches','competitions','teams','players','users','stadiums','referees','scorers','line_judges','team_entries','team_staff','match_requests','custom_vis_matches']);

function pathReferences(path, mode = 'api') {
    const found = new Map();
    for (const [pattern, groups] of schema[mode]) {
        const match = new RegExp(pattern, 'd').exec(path);
        if (!match) continue;
        for (const [group, entity] of Object.entries(groups)) {
            const [start, end] = match.indices[Number(group)];
            found.set(start, { entity, value: match[Number(group)], start, end });
        }
    }
    // Static endpoints sharing a collection prefix are not identifiers.
    return [...found.values()].filter(ref => !['all','open','entries'].includes(ref.value));
}

function publicUrl({ database } = {}) {
    return async (req, res, next) => {
        try {
            const db = database || require('../config/db');
            const path = accessPath(req.path);
            const query = new URLSearchParams(req.url.includes('?') ? req.url.slice(req.url.indexOf('?') + 1) : '');
            const refs = pathReferences(path);
            for (const [key, value] of query) if (schema.query[key] && value) refs.push({ entity: schema.query[key], value, key });
            // Reject every non-public identifier before ACLs or controller side effects.
            if (refs.some(ref => !uuidPattern.test(ref.value))) return res.status(400).json({ error: 'A public UUID is required in URLs' });
            const resolved = await Promise.all(refs.map(async ref => {
                const entity = ref.entity === 'matchRecords' ? 'matches' : ref.entity;
                if (!tables.has(entity)) throw Error('Unsupported identifier entity');
                const row = (await db.query(`SELECT id FROM ${entity} WHERE public_id = ?`, [ref.value])).rows[0];
                if (!row && entity === 'custom_vis_matches' && req.method === 'POST' && /^\/vis-custom\/[^/]+\/offline-sync$/.test(path) && req.body?.config) return { ...ref, id: `custom-${ref.value.toLowerCase()}` };
                if (!row) return null;
                return { ...ref, id: String(row.id) };
            }));
            if (resolved.some(ref => !ref)) return res.status(404).json({ error: 'Record not found' });
            let internalPath = path;
            for (const ref of resolved.filter(ref => !ref.key).sort((a,b) => b.start-a.start)) internalPath = internalPath.slice(0,ref.start)+encodeURIComponent(ref.id)+internalPath.slice(ref.end);
            for (const ref of resolved.filter(ref => ref.key)) query.set(ref.key,ref.id);
            // Controllers and ACLs continue to use the original database primary keys.
            req.publicUrl = req.originalUrl;
            req.url = internalPath + (query.size ? `?${query}` : '');
            next();
        } catch (error) {
            if (error.status === 400) return res.status(400).json({ error: 'Invalid request path' });
            console.error('Public URL resolution failed:', error.code || error.name);
            res.status(500).json({ error: 'Unable to resolve public URL' });
        }
    };
}

module.exports = { publicUrl, pathReferences, tables };
