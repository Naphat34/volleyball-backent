import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionLock } from './actionLock.js';

test('rapid clicks execute an async action once until its request settles', async () => {
    const lock = createActionLock();
    let finish;
    let calls = 0;
    const pending = lock.run(() => { calls++; return new Promise(resolve => { finish = resolve; }); }, 0);
    await lock.run(() => { calls++; }, 0);
    assert.equal(calls, 1);
    assert.equal(lock.busy, true);
    finish();
    await pending;
    await lock.run(() => { calls++; }, 0);
    assert.equal(calls, 2);
    assert.equal(lock.busy, false);
});

test('failed actions release the lock so users can retry', async () => {
    const lock = createActionLock();
    await assert.rejects(lock.run(() => { throw Error('API failed'); }, 0), /API failed/);
    assert.equal(lock.busy, false);
    assert.equal(await lock.run(() => 'retry succeeded', 0), 'retry succeeded');
});

test('separate buttons do not share locks and synchronous actions also block rapid repeats', async () => {
    const first = createActionLock(), second = createActionLock();
    let calls = 0;
    const pending = first.run(() => { calls++; }, 0);
    await first.run(() => { calls++; }, 0);
    await second.run(() => { calls++; }, 0);
    await pending;
    assert.equal(calls, 2);
});
