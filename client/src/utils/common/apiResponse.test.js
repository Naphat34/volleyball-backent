import test from 'node:test';
import assert from 'node:assert/strict';
import { rewriteApiUrls } from './apiResponse.js';
test('report CSV/Excel blobs and other binary downloads keep their identity and content', async () => {
    for (const type of ['text/csv', 'application/vnd.ms-excel', 'application/pdf']) {
        const blob = new Blob(['ข้อมูลรายงาน'], { type });
        const output = rewriteApiUrls(blob, 'https://api.example.test');
        assert.equal(output, blob);
        assert.equal(await output.text(), 'ข้อมูลรายงาน');
    }
    const bytes = new Uint8Array([1, 2, 3]);
    assert.equal(rewriteApiUrls(bytes, 'https://api.example.test'), bytes);
    assert.equal(rewriteApiUrls(bytes.buffer, 'https://api.example.test'), bytes.buffer);
});
test('ordinary nested JSON image URLs still use the configured origin', () => {
    const source = { teams: [{ logo: 'http://localhost:3000/uploads/logo.png' }], empty: null, count: 1 };
    const result = rewriteApiUrls(source, 'https://api.example.test');
    assert.equal(result.teams[0].logo, 'https://api.example.test/uploads/logo.png');
    assert.equal(source.teams[0].logo, 'http://localhost:3000/uploads/logo.png');
    assert.equal(result.empty, null);
});
