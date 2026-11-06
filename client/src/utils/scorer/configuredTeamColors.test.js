import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeConfiguredTeamColors } from './configuredTeamColors.js';

test('saved match uniforms supersede stale cached colors before first serve', () => {
    const colors = { home: '#000000', away: '#ffffff' };
    assert.deepEqual(mergeConfiguredTeamColors({ status: 'scheduled', home_team_color: '#ef4444', away_team_color: '#22c55e' }, colors), { home: '#ef4444', away: '#22c55e' });
    assert.deepEqual(colors, { home: '#000000', away: '#ffffff' });
});

test('live matches preserve scorer colors and absent overrides preserve team defaults', () => {
    const colors = { home: '#000000', away: '#ffffff' };
    for (const match of [{ status: 'live', home_team_color: '#ef4444' }, { status: 'scheduled', first_serve_team_id: 1, home_team_color: '#ef4444' }, { status: 'scheduled' }]) {
        assert.deepEqual(mergeConfiguredTeamColors(match, colors), colors);
    }
});
