const assert = require('node:assert/strict');
const db = require('../config/db');
const controller = require('../controllers/officialController');
async function run() {
    const connection = await db.connect();
    const originalQuery = db.query;
    try {
        await connection.beginTransaction();
        db.query = connection.query;
        const invoke = async (method, req) => {
            let status = 200, payload;
            await controller[method](req, { status(value) { status = value; return this; }, json(value) { payload = value; } });
            assert.ok(status < 400, `${method}: ${JSON.stringify(payload)}`);
            return payload;
        };
        for (const [kind, list] of [['Referee', 'getAllReferees'], ['Scorer', 'getAllScorers'], ['LineJudge', 'getAllLineJudges']]) {
            const body = { firstname: 'ทดสอบ', lastname: 'ภาษา', country: 'THA', code: 'TEST', firstname_en: ' Test ', lastname_en: ' Official ' };
            const created = await invoke(`create${kind}`, { body });
            assert.equal(created.firstname_en, 'Test');
            assert.equal(created.lastname_en, 'Official');
            let updated = await invoke(`update${kind}`, { params: { id: created.id }, body: { ...body, firstname_en: 'Updated' } });
            assert.equal(updated.firstname_en, 'Updated');
            const legacy = { ...body }; delete legacy.firstname_en; delete legacy.lastname_en;
            updated = await invoke(`update${kind}`, { params: { id: created.id }, body: legacy });
            assert.equal(updated.firstname_en, 'Updated');
            assert.ok((await invoke(list, {})).some(row => row.id === created.id && row.lastname_en === 'Official'));
            updated = await invoke(`update${kind}`, { params: { id: created.id }, body: { ...body, firstname_en: '', lastname_en: '' } });
            assert.equal(updated.firstname_en, '');
            assert.equal(updated.lastname_en, '');
            console.log(`${kind}: create, update, preserve, list and clear passed`);
        }
    } finally {
        db.query = originalQuery;
        await connection.rollback();
        connection.release();
        await db.pool.end();
    }
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
